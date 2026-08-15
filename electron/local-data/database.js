const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const { eq, and, or, desc, sql, getTableColumns } = require('drizzle-orm');
const schema = require('./schema');

const SCHEMA_VERSION = 1;
const MIGRATIONS = path.join(__dirname, 'migrations');

const ENTITY_TABLES = {
  movement: schema.movements,
  account: schema.accounts,
  category: schema.categories,
  loan: schema.loans,
  installmentpurchase: schema.installmentPurchases,
  recurringtransaction: schema.recurringTransactions,
  portfolioentity: schema.portfolioEntities,
  portfoliovaluation: schema.portfolioValuations,
  investmenttransaction: schema.investmentTransactions,
  creditcardterms: schema.creditCardTerms,
};

const DEFAULT_INSTRUMENT_TYPES = [
  ['Stock', 'Acción'], ['ETF', 'ETF'], ['Fund', 'Fondo'], ['Bond', 'Bono'],
  ['Crypto', 'Cripto'], ['Cash', 'Efectivo'], ['Other', 'Otro'],
];

const NON_ORDINARY_KINDS = new Set([
  'Transfer', 'Saving', 'LoanPayment', 'LoanDisbursement', 'LoanGiven', 'LoanReceived', 'CreditPayment', 'Investment',
]);

const VIEWS = `
CREATE VIEW IF NOT EXISTS v_loan_status AS
SELECT l.id AS loan_id,
  COALESCE(SUM(m.principal_component), 0) AS paid_principal,
  COALESCE(SUM(m.interest_component), 0) AS paid_interest,
  l.principal - COALESCE(SUM(m.principal_component), 0) AS outstanding_principal,
  COUNT(m.id) AS paid_months,
  l.term_months - COUNT(m.id) AS remaining_months
FROM loans l
LEFT JOIN movements m ON m.loan_id = l.id AND m.kind = 'LoanPayment'
GROUP BY l.id;

CREATE VIEW IF NOT EXISTS v_installment_status AS
SELECT ip.id AS installment_purchase_id,
  COUNT(m.id) AS paid_count,
  COALESCE(SUM(m.amount), 0) AS paid_amount,
  ip.total_amount - COALESCE(SUM(m.amount), 0) AS remaining_amount
FROM installment_purchases ip
LEFT JOIN movements m ON m.installment_purchase_id = ip.id AND m.kind = 'InstallmentPayment'
GROUP BY ip.id;

CREATE VIEW IF NOT EXISTS v_monthly_summary AS
SELECT substr(m.date, 1, 7) AS ym,
  SUM(CASE WHEN m.type = 'Income' THEN m.amount_base ELSE 0 END) AS total_income,
  SUM(CASE WHEN m.type = 'Expense' THEN m.amount_base ELSE 0 END) AS total_expense
FROM movements m
GROUP BY substr(m.date, 1, 7);

CREATE VIEW IF NOT EXISTS v_latest_valuation AS
SELECT pv.* FROM portfolio_valuations pv
JOIN (SELECT portfolio_entity_id, MAX(date) AS md FROM portfolio_valuations GROUP BY portfolio_entity_id) last
  ON last.portfolio_entity_id = pv.portfolio_entity_id AND last.md = pv.date;

CREATE VIEW IF NOT EXISTS v_net_worth AS
SELECT
  COALESCE(SUM(CASE WHEN pe.kind = 'Asset' THEN lv.amount_base ELSE 0 END), 0) AS total_assets,
  COALESCE(SUM(CASE WHEN pe.kind = 'Liability' THEN lv.amount_base ELSE 0 END), 0) AS total_liabilities
FROM portfolio_entities pe
LEFT JOIN v_latest_valuation lv ON lv.portfolio_entity_id = pe.id
WHERE pe.is_active = 1;
`;

const number = (value) => Number(value || 0);

class LocalDatabase {
  constructor({ app, logger, databasePath }) {
    this.app = app;
    this.logger = logger;
    this.databasePath = databasePath || path.join(app.getPath('userData'), 'data', 'finanzas.sqlite3');
  }

  open() {
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.sqlite = new Database(this.databasePath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('busy_timeout = 5000');
    this.orm = drizzle(this.sqlite, { schema });
    migrate(this.orm, { migrationsFolder: MIGRATIONS });
    this.sqlite.exec(VIEWS);
    this.sqlite.pragma('foreign_keys = ON');
    this.#seedInstrumentTypes();
    return this.status();
  }

  close() {
    this.sqlite?.close();
    this.sqlite = null;
    this.orm = null;
  }

  status() {
    return { schemaVersion: SCHEMA_VERSION, path: this.databasePath, syncEnabled: false, encryptedPayloads: false };
  }

  owners() {
    return [];
  }

  list(entity) {
    return this.orm.select().from(this.#table(entity)).all();
  }

  get(entity, id) {
    const table = this.#table(entity);
    return this.orm.select().from(table).where(eq(table.id, id)).get() ?? null;
  }

  put(entity, value) {
    return this.#put(entity, value || {});
  }

  putMany(entity, values) {
    const run = this.sqlite.transaction((rows) => rows.map((value) => this.#put(entity, value)));
    return run(Array.isArray(values) ? values : []);
  }

  applyBatch(operations) {
    if (!Array.isArray(operations) || operations.length === 0) throw new Error('At least one local operation is required');
    for (const item of operations) {
      if (!item || !['put', 'remove'].includes(item.action)) throw new Error('Unsupported local batch action');
      this.#table(item.kind);
      if (item.action === 'put' && (!item.value || typeof item.value !== 'object')) throw new Error('A document is required for local put');
      if (item.action === 'remove' && (!item.id || typeof item.id !== 'string')) throw new Error('An id is required for local remove');
    }
    const run = this.sqlite.transaction(() =>
      operations.map((item) => (item.action === 'put' ? this.#put(item.kind, item.value) : this.remove(item.kind, item.id))),
    );
    return run();
  }

  remove(entity, id) {
    const table = this.#table(entity);
    return this.orm.delete(table).where(eq(table.id, id)).run().changes > 0;
  }

  movements(query = {}) {
    const m = schema.movements;
    const conditions = [];
    if (query.year && query.month) {
      const ym = `${query.year}-${String(query.month).padStart(2, '0')}`;
      conditions.push(sql`substr(${m.date}, 1, 7) = ${ym}`);
    }
    if (query.currency) conditions.push(eq(m.currency, query.currency));
    if (query.categoryId) conditions.push(eq(m.categoryId, query.categoryId));
    if (query.accountId) conditions.push(eq(m.accountId, query.accountId));
    if (query.type) conditions.push(eq(m.type, query.type));
    if (query.kind) conditions.push(eq(m.kind, query.kind));
    if (query.portfolioEntityId) {
      conditions.push(or(eq(m.portfolioEntityId, query.portfolioEntityId), eq(m.accountId, query.portfolioEntityId), eq(m.loanId, query.portfolioEntityId)));
    }
    const rows = this.orm
      .select({
        ...getTableColumns(m),
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
        accountName: schema.accounts.name,
      })
      .from(m)
      .leftJoin(schema.categories, eq(m.categoryId, schema.categories.id))
      .leftJoin(schema.accounts, eq(m.accountId, schema.accounts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(m.date))
      .all();
    const total = rows.length;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  summary(year, month) {
    const calculate = (items) => {
      const ordinary = (item) => !NON_ORDINARY_KINDS.has(item.kind);
      const income = items.filter((x) => x.type === 'Income' && ordinary(x)).reduce((sum, x) => sum + number(x.amountBase), 0);
      const ordinaryExpense = items.filter((x) => x.type === 'Expense' && ordinary(x)).reduce((sum, x) => sum + number(x.amountBase), 0);
      const loanInterest = items.filter((x) => x.kind === 'LoanPayment').reduce((sum, x) => sum + number(x.interestComponent), 0);
      const savings = items.filter((x) => x.kind === 'Saving').reduce((sum, x) => sum + number(x.amountBase), 0);
      return { income, expense: ordinaryExpense + loanInterest, savings };
    };
    const items = this.movements({ year, month, page: 1, pageSize: 1_000_000 }).items;
    const previousDate = new Date(Date.UTC(Number(year), Number(month) - 2, 1));
    const previous = this.movements({ year: previousDate.getUTCFullYear(), month: previousDate.getUTCMonth() + 1, page: 1, pageSize: 1_000_000 }).items;
    const current = calculate(items);
    const prior = calculate(previous);
    const delta = (value, base) => (base === 0 ? 0 : ((value - base) / Math.abs(base)) * 100);
    return {
      totalIncome: current.income,
      totalExpense: current.expense,
      balance: current.income - current.expense,
      savings: current.savings,
      savingsRate: current.income > 0 ? (current.savings / current.income) * 100 : 0,
      comparedToPreviousMonth: { incomeDelta: delta(current.income, prior.income), expenseDelta: delta(current.expense, prior.expense) },
    };
  }

  accountBalances(ids, asOf = new Date()) {
    const movements = this.list('movement');
    const accounts = new Map(this.list('account').map((account) => [account.id, account]));
    return Object.fromEntries(
      ids.map((id) => {
        const account = accounts.get(id);
        const related = movements.filter((item) => item.accountId === id);
        const nativeAmount = (item) => {
          if (!account || !item.currency || String(item.currency).toUpperCase() === String(account.currency).toUpperCase()) {
            return number(item.amount);
          }
          return 0;
        };
        const balance = related.reduce((sum, item) => sum + (item.type === 'Income' ? 1 : -1) * nativeAmount(item), 0);
        const balanceBase = related.reduce((sum, item) => sum + (item.type === 'Income' ? 1 : -1) * number(item.amountBase), 0);
        const debtSign = (item) => {
          if (account?.type !== 'Credit') return 0;
          if (item.type === 'Expense' && (item.sourceType === 'CreditCard' || ['CreditPurchase', 'CreditInterest'].includes(item.kind))) return 1;
          if (item.type === 'Income' && (item.sourceType === 'CreditCard' || item.kind === 'CreditPayment')) return -1;
          return 0;
        };
        const outstandingDebt = Math.max(0, related.reduce((sum, item) => sum + debtSign(item) * nativeAmount(item), 0));
        const outstandingDebtBase = Math.max(0, related.reduce((sum, item) => sum + debtSign(item) * number(item.amountBase), 0));
        const [cycleStart, cycleEnd] = this.#cardCycle(account?.billingDay, asOf);
        const cycleSign = (item) => {
          if (account?.type !== 'Credit') return 0;
          const occurred = String(item.date || '').slice(0, 10);
          if (occurred < cycleStart || occurred > cycleEnd) return 0;
          if (item.type === 'Expense' && (item.sourceType === 'CreditCard' || ['CreditPurchase', 'CreditInterest'].includes(item.kind))) return 1;
          if (item.type === 'Income' && item.sourceType === 'CreditCard' && item.kind !== 'CreditPayment') return -1;
          return 0;
        };
        const cycleSpend = Math.max(0, related.reduce((sum, item) => sum + cycleSign(item) * nativeAmount(item), 0));
        const cycleSpendBase = Math.max(0, related.reduce((sum, item) => sum + cycleSign(item) * number(item.amountBase), 0));
        return [id, { balance, balanceBase, outstandingDebt, outstandingDebtBase, cycleSpend, cycleSpendBase, usedInCycle: outstandingDebt, usedInCycleBase: outstandingDebtBase }];
      }),
    );
  }

  backup(destination) {
    const defaultName = `finanzas-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite3`;
    const target = destination ? path.resolve(destination) : path.join(this.app.getPath('userData'), 'backups', defaultName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    this.sqlite.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(this.databasePath, target);
    return { path: target, schemaVersion: SCHEMA_VERSION, revision: this.#revision(this.sqlite) };
  }

  backupPreview(source) {
    const check = new Database(path.resolve(source), { readonly: true });
    try {
      return { schemaVersion: SCHEMA_VERSION, backupRevision: this.#revision(check), currentRevision: this.#revision(this.sqlite) };
    } finally {
      check.close();
    }
  }

  restore(source, expectedCurrentRevision) {
    const candidate = path.resolve(source);
    const check = new Database(candidate, { readonly: true });
    try {
      check.prepare('SELECT COUNT(*) AS count FROM movements').get();
      const currentRevision = this.#revision(this.sqlite);
      if (!expectedCurrentRevision || currentRevision !== expectedCurrentRevision) throw new Error('stale_restore_current_data_changed');
    } finally {
      check.close();
    }
    this.close();
    const rollback = `${this.databasePath}.restore-rollback`;
    if (fs.existsSync(this.databasePath)) fs.copyFileSync(this.databasePath, rollback);
    try {
      fs.copyFileSync(candidate, this.databasePath);
      this.open();
      if (fs.existsSync(rollback)) fs.unlinkSync(rollback);
    } catch (error) {
      if (fs.existsSync(rollback)) fs.copyFileSync(rollback, this.databasePath);
      this.open();
      throw error;
    }
    return this.status();
  }

  #put(entity, value) {
    const table = this.#table(entity);
    const keys = Object.keys(getTableColumns(table));
    const now = new Date().toISOString();
    const id = value.id || crypto.randomUUID();
    const picked = {};
    for (const key of keys) if (key !== 'id' && value[key] !== undefined) picked[key] = value[key];
    const hasTimestamps = keys.includes('updatedAt');
    const row = { ...picked, id };
    if (hasTimestamps) {
      row.createdAt = value.createdAt || now;
      row.updatedAt = now;
    }
    const set = { ...picked };
    delete set.createdAt;
    if (hasTimestamps) set.updatedAt = now;
    const insert = this.orm.insert(table).values(row);
    const finalized = Object.keys(set).length > 0 ? insert.onConflictDoUpdate({ target: table.id, set }) : insert.onConflictDoNothing();
    finalized.run();
    return this.get(entity, id);
  }

  #table(entity) {
    const table = ENTITY_TABLES[String(entity).toLowerCase()];
    if (!table) throw new Error(`Unsupported local entity kind: ${entity}`);
    return table;
  }

  #seedInstrumentTypes() {
    const run = this.sqlite.transaction(() => {
      for (const [code, label] of DEFAULT_INSTRUMENT_TYPES) {
        this.orm.insert(schema.instrumentTypes).values({ code, label, isActive: true }).onConflictDoNothing().run();
      }
    });
    run();
  }

  #revision(database) {
    return database.prepare("SELECT COALESCE(MAX(updated_at), '') AS revision FROM movements").get().revision;
  }

  #cardCycle(billingDay, asOf) {
    const value = asOf instanceof Date
      ? new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()))
      : new Date(`${String(asOf).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(value.getTime())) throw new Error('Invalid account balance date');
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
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
}

module.exports = { LocalDatabase, SCHEMA_VERSION, ENTITY_TABLES };
