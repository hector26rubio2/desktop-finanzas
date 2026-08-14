const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 2;
// Every IUserOwned aggregate emitted by the API change feed must be accepted here.
// Keep the legacy `entity` kind for existing local-only snapshots.
const KINDS = new Set([
  'movement', 'account', 'category', 'entity', 'portfolioentity',
  'portfoliovaluation', 'investmenttransaction', 'loan',
  // `budget` y `financialgoal` ya no existen en el renderer: eran tipos sin
  // producto. Se siguen aceptando aquí para que un respaldo antiguo restaure
  // sin reventar; nada los escribe.
  'budget', 'financialgoal', 'financialoperation', 'installmentpurchase',
  'recurringtransaction',
]);

class LocalDatabase {
  constructor({ app, safeStorage, logger, databasePath, syncEnabled = false }) {
    this.app = app;
    this.safeStorage = safeStorage;
    this.logger = logger;
    this.databasePath = databasePath || path.join(app.getPath('userData'), 'data', 'finanzas.sqlite3');
    this.syncEnabled = syncEnabled;
  }

  open() {
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.key = this.#loadKey();
    this.db = new Database(this.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.#migrate();
    return this.status();
  }

  close() { this.db?.close(); this.db = null; }

  /**
   * Dueños con documentos vivos. Lo usa el alta local para no acuñar un
   * `ownerId` nuevo sobre datos que ya existen: al retirar el API, el id del
   * usuario dejó de venir del servidor y un id nuevo dejaría el libro entero
   * fuera de vista sin borrar nada.
   */
  owners() {
    return this.db.prepare('SELECT owner_id AS ownerId, COUNT(*) AS documents FROM local_documents WHERE deleted = 0 GROUP BY owner_id ORDER BY documents DESC').all();
  }
  status() { return { schemaVersion: Number(this.db.pragma('user_version', { simple: true })), path: this.databasePath, encryptedPayloads: true, syncEnabled: this.syncEnabled }; }

  list(kind, ownerId) {
    this.#assert(kind, ownerId);
    return this.db.prepare('SELECT payload FROM local_documents WHERE kind = ? AND owner_id = ? AND deleted = 0 ORDER BY updated_at DESC').all(kind, ownerId).map((row) => this.#decrypt(row.payload));
  }

  get(kind, ownerId, id) {
    this.#assert(kind, ownerId);
    const row = this.db.prepare('SELECT payload FROM local_documents WHERE kind = ? AND owner_id = ? AND id = ? AND deleted = 0').get(kind, ownerId, id);
    return row ? this.#decrypt(row.payload) : null;
  }

  put(kind, ownerId, value, operation = 'upsert') {
    this.#assert(kind, ownerId);
    const now = new Date().toISOString();
    const document = { ...value, id: value.id || crypto.randomUUID(), createdAt: value.createdAt || now, updatedAt: now };
    const changeId = crypto.randomUUID();
    this.db.transaction(() => {
      const existing = this.db.prepare('SELECT revision FROM local_documents WHERE kind=? AND owner_id=? AND id=?').get(kind, ownerId, document.id);
      this.db.prepare(`INSERT INTO local_documents(id, kind, owner_id, payload, deleted, updated_at)
        VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(kind, owner_id, id) DO UPDATE SET payload=excluded.payload, deleted=0, updated_at=excluded.updated_at`)
        .run(document.id, kind, ownerId, this.#encrypt(document), now);
      if (operation === 'snapshot') {
        this.db.prepare("UPDATE local_documents SET sync_status='synced' WHERE kind=? AND owner_id=? AND id=?").run(kind, ownerId, document.id);
        return;
      }
      if (!this.syncEnabled) return;
      this.db.prepare('INSERT INTO local_outbox(change_id, kind, entity_id, owner_id, operation, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(changeId, kind, document.id, ownerId, operation, this.#encrypt(document), now);
      this.db.prepare('UPDATE local_outbox SET base_revision=? WHERE change_id=?').run(existing?.revision || null, changeId);
    })();
    return { document, changeId };
  }

  putMany(kind, ownerId, values, operation = 'upsert') {
    return this.db.transaction(() => values.map((value) => this.put(kind, ownerId, value, operation).document))();
  }

  applyBatch(ownerId, operations) {
    if (!Array.isArray(operations) || operations.length === 0) throw new Error('At least one local operation is required');
    for (const item of operations) {
      if (!item || !['put', 'remove'].includes(item.action)) throw new Error('Unsupported local batch action');
      this.#assert(item.kind, ownerId);
      if (item.action === 'put' && (!item.value || typeof item.value !== 'object')) throw new Error('A document is required for local put');
      if (item.action === 'remove' && (!item.id || typeof item.id !== 'string')) throw new Error('An id is required for local remove');
    }
    return this.db.transaction(() => operations.map((item) => item.action === 'put'
      ? this.put(item.kind, ownerId, item.value, item.operation || 'upsert').document
      : this.remove(item.kind, ownerId, item.id, item.operation || 'delete')))();
  }

  remove(kind, ownerId, id, operation = 'delete') {
    this.#assert(kind, ownerId);
    const existing = this.get(kind, ownerId, id);
    if (!existing) return false;
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare('UPDATE local_documents SET deleted=1, updated_at=? WHERE kind=? AND owner_id=? AND id=?').run(now, kind, ownerId, id);
      if (!this.syncEnabled) return;
      this.db.prepare('INSERT INTO local_outbox(change_id, kind, entity_id, owner_id, operation, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), kind, id, ownerId, operation, this.#encrypt({ id }), now);
    })();
    return true;
  }

  movements(ownerId, query = {}) {
    let items = this.list('movement', ownerId);
    if (query.year && query.month) items = items.filter((item) => { const date = new Date(item.date); return date.getUTCFullYear() === Number(query.year) && date.getUTCMonth() + 1 === Number(query.month); });
    for (const key of ['currency', 'categoryId', 'accountId']) if (query[key]) items = items.filter((item) => item[key] === query[key]);
    if (query.type) items = items.filter((item) => item.type === query.type);
    if (query.portfolioEntityId) items = items.filter((item) => item.portfolioEntityId === query.portfolioEntityId || item.accountId === query.portfolioEntityId || item.loanId === query.portfolioEntityId);
    if (query.portfolioType) items = items.filter((item) => item.portfolioType === query.portfolioType || item.sourceType === query.portfolioType);
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const total = items.length, page = Math.max(1, Number(query.page) || 1), pageSize = Math.max(1, Number(query.pageSize) || 20);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  summary(ownerId, year, month) {
    const excluded = new Set(['Transfer', 'Saving', 'CreditPayment', 'LoanDisbursement', 'LoanPayment']);
    const calculate = (items) => {
      const isOrdinary = (x) => !excluded.has(x.operationType) && !['LoanReceived', 'LoanGiven', 'Saving'].includes(x.subType);
      const income = items.filter((x) => x.type === 'Income' && !x.investmentTransactionType && isOrdinary(x)).reduce((sum, x) => sum + Number(x.amountBase || 0), 0);
      const ordinaryExpense = items.filter((x) => x.type === 'Expense' && (x.investmentTransactionType === 'Fee' || (!x.investmentTransactionType && isOrdinary(x)))).reduce((sum, x) => sum + Number(x.amountBase || 0), 0);
      const loanInterest = items.filter((x) => x.type === 'Expense' && x.operationType === 'LoanPayment').reduce((sum, x) => sum + Number(x.interestComponent || 0) * Number(x.trmApplied || 1), 0);
      const savings = items.filter((x) => x.type === 'Expense' && (x.operationType === 'Saving' || x.subType === 'Saving')).reduce((sum, x) => sum + Number(x.amountBase || 0), 0);
      return { income, expense: ordinaryExpense + loanInterest, savings };
    };
    const items = this.movements(ownerId, { year, month, page: 1, pageSize: 100000 }).items;
    const previousDate = new Date(Date.UTC(Number(year), Number(month) - 2, 1));
    const previousItems = this.movements(ownerId, { year: previousDate.getUTCFullYear(), month: previousDate.getUTCMonth() + 1, page: 1, pageSize: 100000 }).items;
    const current = calculate(items), previous = calculate(previousItems);
    const delta = (value, prior) => prior === 0 ? 0 : (value - prior) / Math.abs(prior) * 100;
    return { totalIncome: current.income, totalExpense: current.expense, balance: current.income - current.expense, savings: current.savings, savingsRate: current.income > 0 ? current.savings / current.income * 100 : 0, comparedToPreviousMonth: { incomeDelta: delta(current.income, previous.income), expenseDelta: delta(current.expense, previous.expense) } };
  }

  accountBalances(ownerId, ids, asOf = new Date()) {
    const movements = this.list('movement', ownerId);
    const accounts = new Map(this.list('account', ownerId).map((account) => [account.id, account]));
    return Object.fromEntries(ids.map((id) => {
      const account = accounts.get(id);
      const related = movements.filter((item) => item.accountId === id);
      const nativeAmount = (item) => {
        if (!account || !item.currency || String(item.currency).toUpperCase() === String(account.currency).toUpperCase()) {
          return Number(item.amount || 0);
        }
        return 0;
      };
      const balance = related.reduce((sum, item) => sum + (item.type === 'Income' ? 1 : -1) * nativeAmount(item), 0);
      const balanceBase = related.reduce((sum, item) => sum + (item.type === 'Income' ? 1 : -1) * Number(item.amountBase || 0), 0);
      const debtSign = (item) => {
        if (account?.type !== 'Credit') return 0;
        if (item.type === 'Expense' && (item.sourceType === 'CreditCard' || ['CreditPurchase', 'CreditInterest'].includes(item.operationType))) return 1;
        if (item.type === 'Income' && (item.sourceType === 'CreditCard' || item.operationType === 'CreditPayment')) return -1;
        return 0;
      };
      const outstandingDebt = Math.max(0, related.reduce((sum, item) => sum + debtSign(item) * nativeAmount(item), 0));
      const outstandingDebtBase = Math.max(0, related.reduce((sum, item) => sum + debtSign(item) * Number(item.amountBase || 0), 0));
      const [cycleStart, cycleEnd] = this.#cardCycle(account?.billingDay, asOf);
      const cycleSign = (item) => {
        if (account?.type !== 'Credit') return 0;
        const occurred = String(item.date || '').slice(0, 10);
        if (occurred < cycleStart || occurred > cycleEnd) return 0;
        if (item.type === 'Expense' && (item.sourceType === 'CreditCard' || ['CreditPurchase', 'CreditInterest'].includes(item.operationType))) return 1;
        if (item.type === 'Income' && item.sourceType === 'CreditCard' && item.operationType !== 'CreditPayment') return -1;
        return 0;
      };
      const cycleSpend = Math.max(0, related.reduce((sum, item) => sum + cycleSign(item) * nativeAmount(item), 0));
      const cycleSpendBase = Math.max(0, related.reduce((sum, item) => sum + cycleSign(item) * Number(item.amountBase || 0), 0));
      return [id, {
        balance,
        balanceBase,
        outstandingDebt,
        outstandingDebtBase,
        cycleSpend,
        cycleSpendBase,
        // Backwards-compatible alias. New consumers should use outstandingDebt.
        usedInCycle: outstandingDebt,
        usedInCycleBase: outstandingDebtBase,
      }];
    }));
  }

  outbox(ownerId) {
    return this.db.prepare('SELECT change_id, kind, entity_id, operation, payload, occurred_at, base_revision, attempts FROM local_outbox WHERE owner_id=? AND dispatched_at IS NULL ORDER BY sequence LIMIT 100').all(ownerId).map((row) => ({ changeId: row.change_id, kind: row.kind, entityId: row.entity_id, operation: row.operation, payload: this.#decrypt(row.payload), occurredAt: row.occurred_at, baseRevision: row.base_revision, attempts: row.attempts }));
  }

  syncStatus(ownerId) {
    const state = this.db.prepare('SELECT cursor, device_id, last_sync_at, last_error FROM local_sync_state WHERE owner_id=?').get(ownerId);
    return { cursor: state?.cursor || 0, deviceId: state?.device_id || null, lastSyncAt: state?.last_sync_at || null, lastError: state?.last_error || null, pending: this.db.prepare('SELECT COUNT(*) n FROM local_outbox WHERE owner_id=? AND dispatched_at IS NULL').get(ownerId).n, conflicts: this.db.prepare("SELECT COUNT(*) n FROM local_conflicts WHERE owner_id=? AND status='open'").get(ownerId).n };
  }

  ensureDevice(ownerId, proposed) {
    const existing = this.syncStatus(ownerId).deviceId;
    const deviceId = existing || proposed;
    this.db.prepare(`INSERT INTO local_sync_state(owner_id, cursor, device_id) VALUES (?, 0, ?)
      ON CONFLICT(owner_id) DO UPDATE SET device_id=COALESCE(local_sync_state.device_id, excluded.device_id)`).run(ownerId, deviceId);
    return deviceId;
  }

  recordPushResults(ownerId, results) {
    this.db.transaction(() => {
      for (const result of results) {
        if (result.status === 'accepted' || result.status === 'duplicate') {
          this.db.prepare('UPDATE local_outbox SET dispatched_at=?, last_error=NULL WHERE owner_id=? AND change_id=?').run(new Date().toISOString(), ownerId, result.changeId);
          if (result.revision) this.db.prepare('UPDATE local_documents SET revision=?, sync_status=? WHERE owner_id=? AND id=(SELECT entity_id FROM local_outbox WHERE change_id=?)').run(result.revision, 'synced', ownerId, result.changeId);
        } else if (result.status === 'conflict') {
          const pending = this.db.prepare('SELECT * FROM local_outbox WHERE owner_id=? AND change_id=?').get(ownerId, result.changeId);
          if (pending) this.#insertConflict(ownerId, pending.kind, pending.entity_id, pending.change_id, pending.payload, result.serverRevision, result.error);
          this.db.prepare('UPDATE local_outbox SET attempts=attempts+1, last_error=? WHERE owner_id=? AND change_id=?').run(result.error || result.status, ownerId, result.changeId);
        } else this.db.prepare('UPDATE local_outbox SET attempts=attempts+1, last_error=? WHERE owner_id=? AND change_id=?').run(result.error || result.status, ownerId, result.changeId);
      }
    })();
  }

  recordSyncError(ownerId, error) {
    this.db.prepare(`INSERT INTO local_sync_state(owner_id, cursor, last_error) VALUES (?, 0, ?)
      ON CONFLICT(owner_id) DO UPDATE SET last_error=excluded.last_error`).run(ownerId, String(error).slice(0, 500));
    this.db.prepare('UPDATE local_outbox SET attempts=attempts+1, last_error=? WHERE owner_id=? AND dispatched_at IS NULL').run(String(error).slice(0, 500), ownerId);
  }

  applyRemotePage(ownerId, changes, nextCursor) {
    this.db.transaction(() => {
      for (const change of changes) {
        const kind = String(change.kind).toLowerCase();
        this.#assert(kind, ownerId);
        const pending = this.db.prepare('SELECT * FROM local_outbox WHERE owner_id=? AND kind=? AND entity_id=? AND dispatched_at IS NULL ORDER BY sequence LIMIT 1').get(ownerId, kind, change.entityId);
        if (pending && change.deviceId !== this.syncStatus(ownerId).deviceId) {
          this.#insertConflict(ownerId, kind, change.entityId, pending.change_id, pending.payload, change.revision, 'concurrent_remote_change', this.#encrypt(change.isTombstone ? { id: change.entityId, __tombstone: true } : change.document));
          continue;
        }
        if (change.isTombstone) this.db.prepare('UPDATE local_documents SET deleted=1, revision=?, sync_status=?, updated_at=? WHERE kind=? AND owner_id=? AND id=?').run(change.revision, 'synced', new Date().toISOString(), kind, ownerId, change.entityId);
        else this.db.prepare(`INSERT INTO local_documents(id, kind, owner_id, payload, deleted, updated_at, revision, sync_status)
          VALUES (?, ?, ?, ?, 0, ?, ?, 'synced') ON CONFLICT(kind, owner_id, id) DO UPDATE SET payload=excluded.payload, deleted=0, updated_at=excluded.updated_at, revision=excluded.revision, sync_status='synced'`)
          .run(change.entityId, kind, ownerId, this.#encrypt(change.document), new Date().toISOString(), change.revision);
      }
      this.db.prepare(`INSERT INTO local_sync_state(owner_id, cursor, last_sync_at, last_error) VALUES (?, ?, ?, NULL)
        ON CONFLICT(owner_id) DO UPDATE SET cursor=excluded.cursor, last_sync_at=excluded.last_sync_at, last_error=NULL`).run(ownerId, nextCursor, new Date().toISOString());
    })();
  }

  conflicts(ownerId) {
    return this.db.prepare("SELECT id, kind, entity_id, change_id, local_payload, remote_payload, server_revision, reason, created_at FROM local_conflicts WHERE owner_id=? AND status='open' ORDER BY created_at").all(ownerId).map((row) => ({ id: row.id, kind: row.kind, entityId: row.entity_id, changeId: row.change_id, local: this.#decrypt(row.local_payload), remote: row.remote_payload ? this.#decrypt(row.remote_payload) : null, serverRevision: row.server_revision, reason: row.reason, createdAt: row.created_at }));
  }

  importServerConflicts(ownerId, conflicts) {
    this.db.transaction(() => {
      for (const item of conflicts) {
        const kind = String(item.entityType || '').toLowerCase();
        if (!KINDS.has(kind)) continue;
        const existing = this.db.prepare('SELECT payload FROM local_documents WHERE owner_id=? AND kind=? AND id=?').get(ownerId, kind, item.entityId);
        let payload = existing?.payload;
        if (!payload) { try { payload = this.#encrypt(JSON.parse(item.clientPayloadJson || '{}')); } catch (_) { payload = this.#encrypt({ id: item.entityId }); } }
        this.#insertConflict(ownerId, kind, item.entityId, item.changeId, payload, item.serverRevision, 'server_revision_conflict');
      }
    })();
  }

  resolveConflict(ownerId, id, resolution) {
    const conflict = this.db.prepare("SELECT * FROM local_conflicts WHERE owner_id=? AND id=? AND status='open'").get(ownerId, id);
    if (!conflict) throw new Error('Conflict not found');
    if (!['keep-local', 'accept-server'].includes(resolution)) throw new Error('Explicit conflict resolution is required');
    this.db.transaction(() => {
      if (resolution === 'accept-server' && conflict.remote_payload) {
        const remote = this.#decrypt(conflict.remote_payload);
        if (remote.__tombstone) this.db.prepare("UPDATE local_documents SET revision=?, sync_status='synced', deleted=1, updated_at=? WHERE owner_id=? AND kind=? AND id=?").run(conflict.server_revision, new Date().toISOString(), ownerId, conflict.kind, conflict.entity_id);
        else this.db.prepare("UPDATE local_documents SET payload=?, revision=?, sync_status='synced', deleted=0, updated_at=? WHERE owner_id=? AND kind=? AND id=?").run(conflict.remote_payload, conflict.server_revision, new Date().toISOString(), ownerId, conflict.kind, conflict.entity_id);
      }
      if (resolution === 'keep-local') this.db.prepare('UPDATE local_outbox SET change_id=?, base_revision=?, attempts=0, last_error=NULL WHERE owner_id=? AND change_id=?').run(crypto.randomUUID(), conflict.server_revision, ownerId, conflict.change_id);
      else this.db.prepare('UPDATE local_outbox SET dispatched_at=?, last_error=NULL WHERE owner_id=? AND change_id=?').run(new Date().toISOString(), ownerId, conflict.change_id);
      this.db.prepare("UPDATE local_conflicts SET status='resolved', resolution=?, resolved_at=? WHERE id=?").run(resolution, new Date().toISOString(), id);
    })();
  }

  backup(destination) {
    const defaultName = `finanzas-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite3`;
    const target = destination
      ? path.resolve(destination)
      : path.join(this.app.getPath('userData'), 'backups', defaultName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(this.databasePath, target);
    return { path: target, schemaVersion: SCHEMA_VERSION, revision: this.#revision(this.db) };
  }

  backupPreview(source) {
    const candidate = path.resolve(source), check = new Database(candidate, { readonly: true });
    try { return { schemaVersion: Number(check.pragma('user_version', { simple: true })), backupRevision: this.#revision(check), currentRevision: this.#revision(this.db) }; }
    finally { check.close(); }
  }

  restore(source, expectedCurrentRevision) {
    const candidate = path.resolve(source);
    const check = new Database(candidate, { readonly: true });
    try {
      const version = Number(check.pragma('user_version', { simple: true }));
      check.prepare('SELECT COUNT(*) AS count FROM local_documents').get();
      if (version > SCHEMA_VERSION) throw new Error(`Backup schema ${version} is newer than supported schema ${SCHEMA_VERSION}`);
      const currentRevision = this.#revision(this.db);
      if (!expectedCurrentRevision || currentRevision !== expectedCurrentRevision) throw new Error('stale_restore_current_data_changed');
    } finally { check.close(); }
    this.close();
    const rollback = `${this.databasePath}.restore-rollback`;
    if (fs.existsSync(this.databasePath)) fs.copyFileSync(this.databasePath, rollback);
    try { fs.copyFileSync(candidate, this.databasePath); this.open(); if (fs.existsSync(rollback)) fs.unlinkSync(rollback); }
    catch (error) { if (fs.existsSync(rollback)) fs.copyFileSync(rollback, this.databasePath); this.open(); throw error; }
    return this.status();
  }
  #revision(database) { return database.prepare("SELECT COALESCE(MAX(updated_at),'') AS revision FROM local_documents").get().revision; }

  #cardCycle(billingDay, asOf) {
    const value = asOf instanceof Date
      ? new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()))
      : new Date(`${String(asOf).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(value.getTime())) throw new Error('Invalid account balance date');
    const year = value.getUTCFullYear(), month = value.getUTCMonth();
    const day = Math.max(1, Math.min(31, Number(billingDay) || 1));
    const boundary = (y, m) => {
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y, m, Math.min(day, last)));
    };
    const currentBoundary = boundary(year, month);
    const start = value >= currentBoundary ? currentBoundary : boundary(year, month - 1);
    const next = value >= currentBoundary ? boundary(year, month + 1) : currentBoundary;
    const end = new Date(next.getTime() - 86400000);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }

  #migrate() {
    const migrations = [{ version: 1, sql: `
      CREATE TABLE IF NOT EXISTS local_documents(id TEXT NOT NULL, kind TEXT NOT NULL, owner_id TEXT NOT NULL, payload BLOB NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(kind, owner_id, id));
      CREATE INDEX IF NOT EXISTS ix_local_documents_owner_kind ON local_documents(owner_id, kind, deleted);
      CREATE TABLE IF NOT EXISTS local_outbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, entity_id TEXT NOT NULL, owner_id TEXT NOT NULL, operation TEXT NOT NULL, payload BLOB NOT NULL, occurred_at TEXT NOT NULL, dispatched_at TEXT NULL);
      CREATE INDEX IF NOT EXISTS ix_local_outbox_pending ON local_outbox(owner_id, dispatched_at, sequence);` },
      { version: 2, sql: `
      ALTER TABLE local_documents ADD COLUMN revision TEXT NULL;
      ALTER TABLE local_documents ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'local';
      ALTER TABLE local_outbox ADD COLUMN base_revision TEXT NULL;
      ALTER TABLE local_outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE local_outbox ADD COLUMN last_error TEXT NULL;
      CREATE TABLE local_sync_state(owner_id TEXT PRIMARY KEY, cursor INTEGER NOT NULL DEFAULT 0, device_id TEXT NULL, last_sync_at TEXT NULL, last_error TEXT NULL);
      CREATE TABLE local_conflicts(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, change_id TEXT NOT NULL, local_payload BLOB NOT NULL, remote_payload BLOB NULL, server_revision TEXT NULL, reason TEXT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT NULL, created_at TEXT NOT NULL, resolved_at TEXT NULL);
      CREATE INDEX ix_local_conflicts_open ON local_conflicts(owner_id, status, created_at);
      UPDATE local_outbox SET dispatched_at=CURRENT_TIMESTAMP, last_error='legacy_snapshot_not_a_user_change' WHERE operation='snapshot' AND dispatched_at IS NULL;` }];
    for (const migration of migrations) if (Number(this.db.pragma('user_version', { simple: true })) < migration.version) this.db.transaction(() => { this.db.exec(migration.sql); this.db.pragma(`user_version = ${migration.version}`); })();
  }

  #loadKey() {
    const file = `${this.databasePath}.key`;
    if (fs.existsSync(file)) {
      const wrapped = fs.readFileSync(file);
      if (!this.safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable; local financial data cannot be unlocked');
      return Buffer.from(this.safeStorage.decryptString(wrapped), 'base64');
    }
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable; refusing to create an unprotected local database');
    const key = crypto.randomBytes(32);
    fs.writeFileSync(file, this.safeStorage.encryptString(key.toString('base64')), { mode: 0o600 });
    return key;
  }
  #encrypt(value) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv), data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); }
  #decrypt(value) { const raw = Buffer.from(value), decipher = crypto.createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12)); decipher.setAuthTag(raw.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')); }
  #assert(kind, ownerId) { if (!KINDS.has(kind)) throw new Error(`Unsupported local entity kind: ${kind}`); if (!ownerId || typeof ownerId !== 'string') throw new Error('ownerId is required'); }
  #insertConflict(ownerId, kind, entityId, changeId, localPayload, serverRevision, reason, remotePayload = null) {
    if (this.db.prepare("SELECT 1 FROM local_conflicts WHERE owner_id=? AND change_id=? AND status='open'").get(ownerId, changeId)) return;
    this.db.prepare(`INSERT OR IGNORE INTO local_conflicts(id, owner_id, kind, entity_id, change_id, local_payload, remote_payload, server_revision, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), ownerId, kind, entityId, changeId, localPayload, remotePayload, serverRevision, reason, new Date().toISOString());
    this.db.prepare("UPDATE local_documents SET sync_status='conflict' WHERE owner_id=? AND kind=? AND id=?").run(ownerId, kind, entityId);
  }
}

module.exports = { LocalDatabase, SCHEMA_VERSION };
