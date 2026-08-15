const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { performance } = require('node:perf_hooks');
const { LocalDatabase } = require('./database');
const { LocalAuthStore } = require('./auth-store');

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (v) => Buffer.from(`wrapped:${v}`),
  decryptString: (v) => v.toString().slice(8),
};
const logger = { info() {}, warn() {}, error() {} };

function start(root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-'))) {
  const databasePath = path.join(root, 'finanzas.sqlite3');
  const app = { getPath: () => root };
  const db = new LocalDatabase({ app, logger, databasePath });
  db.open();
  const auth = new LocalAuthStore({ app, safeStorage, logger, profilePath: path.join(root, 'profile.dat') });
  return { root, databasePath, db, auth };
}

test('release journey: local profile owns the ledger across password change and recovery', () => {
  const f = start();
  const enrollment = f.auth.register({ name: 'Titular', email: 'titular@local', password: 'contrasena1', baseCurrency: 'COP', existingOwners: f.db.owners() });
  const owner = enrollment.ownerId;
  assert.ok(owner);

  f.db.put('movement', { id: 'e2e-1', type: 'Expense', kind: 'Expense', amount: 120, amountBase: 120, currency: 'COP', trmApplied: 1, date: '2026-07-05' });
  assert.equal(f.db.list('movement').length, 1);
  f.db.close();

  const restarted = start(f.root);
  assert.equal(restarted.auth.status().hasProfile, true);
  assert.equal(restarted.auth.login({ password: 'contrasena1' }).ownerId, owner);
  assert.equal(restarted.db.list('movement').length, 1);

  restarted.auth.changePassword({ currentPassword: 'contrasena1', newPassword: 'contrasena2' });
  assert.equal(restarted.auth.login({ password: 'contrasena2' }).ownerId, owner);

  const recovered = restarted.auth.recover({ recoveryCode: enrollment.recoveryCode, newPassword: 'contrasena3' });
  assert.equal(recovered.ownerId, owner);
  assert.equal(restarted.db.get('movement', 'e2e-1').amountBase, 120);
  restarted.db.close();
});

test('release journey: first start, offline close, backup restore and monthly close', () => {
  const f = start();
  assert.equal(f.db.status().schemaVersion, 1);
  f.db.put('movement', { id: 'income', type: 'Income', kind: 'Income', amount: 1000, amountBase: 1000, currency: 'COP', trmApplied: 1, date: '2026-07-01' });
  f.db.put('movement', { id: 'expense', type: 'Expense', kind: 'Expense', amount: 250, amountBase: 250, currency: 'COP', trmApplied: 1, date: '2026-07-15' });
  const backup = path.join(f.root, 'backup.sqlite3');
  const created = f.db.backup(backup);
  f.db.close();

  const reopened = start(f.root).db;
  const close = reopened.summary(2026, 7);
  assert.equal(close.totalIncome, 1000);
  assert.equal(close.totalExpense, 250);
  assert.equal(close.balance, 750);
  const preview = reopened.backupPreview(backup);
  assert.equal(preview.backupRevision, created.revision);
  reopened.restore(backup, preview.currentRevision);
  reopened.close();
});

test('performance budgets: 1000 movements and monthly close', () => {
  const { db } = start();
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: `m${i}`,
    type: i % 4 ? 'Expense' : 'Income',
    kind: i % 4 ? 'Expense' : 'Income',
    amount: 10,
    amountBase: 10,
    currency: 'COP',
    trmApplied: 1,
    date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
  }));
  let at = performance.now();
  db.putMany('movement', rows);
  const writeMs = performance.now() - at;
  at = performance.now();
  const page = db.movements({ year: 2026, month: 7, page: 1, pageSize: 50 });
  const queryMs = performance.now() - at;
  at = performance.now();
  db.summary(2026, 7);
  const closeMs = performance.now() - at;
  assert.equal(page.total, 1000);
  assert.ok(writeMs < 5000, `write ${writeMs}ms`);
  assert.ok(queryMs < 500, `query ${queryMs}ms`);
  assert.ok(closeMs < 1000, `close ${closeMs}ms`);
  db.close();
});
