const assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  test = require('node:test');
const { performance } = require('node:perf_hooks');
const { LocalDatabase } = require('./database');
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (v) => Buffer.from(`wrapped:${v}`),
  decryptString: (v) => v.toString().slice(8),
};
const logger = { info() {}, error() {} };
function start(root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-'))) {
  const databasePath = path.join(root, 'finanzas.sqlite3'),
    app = { getPath: () => root },
    db = new LocalDatabase({ app, safeStorage, logger, databasePath, syncEnabled: false });
  db.open();
  return { root, databasePath, db };
}
test('release journey: first start, offline close, backup restore and monthly close', () => {
  const f = start();
  assert.equal(f.db.status().schemaVersion, 2);
  f.db.put(
    'movement',
    'owner',
    {
      id: 'income',
      type: 'Income',
      amount: 1000,
      amountBase: 1000,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-07-01',
    },
    'create',
  );
  f.db.put(
    'movement',
    'owner',
    {
      id: 'expense',
      type: 'Expense',
      amount: 250,
      amountBase: 250,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-07-15',
    },
    'create',
  );
  assert.equal(f.db.outbox('owner').length, 0);
  const backup = path.join(f.root, 'backup.sqlite3'),
    created = f.db.backup(backup);
  f.db.close();
  const reopened = start(f.root).db;
  assert.equal(reopened.status().schemaVersion, 2);
  const close = reopened.summary('owner', 2026, 7);
  assert.equal(close.totalIncome, 1000);
  assert.equal(close.totalExpense, 250);
  assert.equal(close.balance, 750);
  const preview = reopened.backupPreview(backup);
  assert.equal(preview.backupRevision, created.revision);
  reopened.restore(backup, preview.currentRevision);
  reopened.close();
});
test('performance budgets: 1000 encrypted movements and monthly close', () => {
  const { db } = start();
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: `m${i}`,
    type: i % 4 ? 'Expense' : 'Income',
    amount: 10,
    amountBase: 10,
    currency: 'COP',
    trmApplied: 1,
    date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
  }));
  let at = performance.now();
  db.putMany('movement', 'perf', rows, 'snapshot');
  const writeMs = performance.now() - at;
  at = performance.now();
  const page = db.movements('perf', { year: 2026, month: 7, page: 1, pageSize: 50 });
  const queryMs = performance.now() - at;
  at = performance.now();
  db.summary('perf', 2026, 7);
  const closeMs = performance.now() - at;
  assert.equal(page.total, 1000);
  assert.ok(writeMs < 5000, `write ${writeMs}ms`);
  assert.ok(queryMs < 500, `query ${queryMs}ms`);
  assert.ok(closeMs < 1000, `close ${closeMs}ms`);
  db.close();
});
