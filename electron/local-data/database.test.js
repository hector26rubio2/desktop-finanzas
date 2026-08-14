const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { LocalDatabase } = require('./database');

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`wrapped:${value}`),
  decryptString: (value) => value.toString().slice('wrapped:'.length),
};
const logger = { info() {}, error() {} };

function fixture(syncEnabled = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-local-'));
  const app = { getPath: () => root };
  const databasePath = path.join(root, 'data.sqlite3');
  const database = new LocalDatabase({ app, safeStorage, logger, databasePath, syncEnabled });
  database.open();
  return { root, databasePath, database };
}

test('sync-compat mode persists encrypted movements and emits outbox changes', () => {
  const { database, databasePath } = fixture(true);
  assert.equal(database.status().schemaVersion, 2);
  const movement = { id: 'm1', type: 'Expense', amount: 100, amountBase: 400000, currency: 'USD', trmApplied: 4000, date: '2026-07-12T00:00:00Z', description: 'sensitive merchant' };
  database.put('movement', 'owner-a', movement, 'create');
  assert.equal(database.movements('owner-a', { year: 2026, month: 7 }).items[0].amountBase, 400000);
  assert.equal(database.list('movement', 'owner-b').length, 0);
  assert.equal(database.outbox('owner-a')[0].operation, 'create');
  database.close();
  assert.equal(fs.readFileSync(databasePath).includes(Buffer.from('sensitive merchant')), false);

  const reopened = new LocalDatabase({ app: { getPath: () => path.dirname(databasePath) }, safeStorage, logger, databasePath });
  reopened.open();
  assert.equal(reopened.get('movement', 'owner-a', 'm1').description, 'sensitive merchant');
  reopened.close();
});

test('local-only mode persists changes without accumulating a sync outbox', () => {
  const { database } = fixture(false);
  database.put('movement', 'owner', { id: 'm1', type: 'Expense', amount: 20 }, 'create');
  database.put('account', 'owner', { id: 'a1', name: 'Cash' }, 'create');
  database.remove('movement', 'owner', 'm1');
  assert.equal(database.outbox('owner').length, 0);
  assert.equal(database.status().syncEnabled, false);
  assert.equal(database.get('account', 'owner', 'a1').name, 'Cash');
  database.close();
});

test('backup and validated restore recover the prior state', () => {
  const { root, database } = fixture();
  database.put('account', 'owner-a', { id: 'a1', name: 'Cash' }, 'create');
  const backup = path.join(root, 'backup.sqlite3');
  database.backup(backup);
  database.put('account', 'owner-a', { id: 'a2', name: 'Bank' }, 'create');
  assert.equal(database.list('account', 'owner-a').length, 2);
  const preview = database.backupPreview(backup);
  database.restore(backup, preview.currentRevision);
  assert.deepEqual(database.list('account', 'owner-a').map((x) => x.id), ['a1']);
  database.close();
});

test('backup chooses a protected local destination when none is provided', () => {
  const { root, database } = fixture(false);
  database.put('account', 'owner-a', { id: 'a1', name: 'Cash' }, 'create');
  const result = database.backup();
  assert.equal(path.dirname(result.path), path.join(root, 'backups'));
  assert.match(path.basename(result.path), /^finanzas-backup-.*\.sqlite3$/);
  assert.equal(fs.existsSync(result.path), true);
  database.close();
});

test('summary excludes transfers and card payments from income and expense', () => {
  const { database } = fixture();
  const base = { currency: 'COP', trmApplied: 1, date: '2026-07-12T00:00:00Z' };
  database.put('movement', 'owner', { ...base, id: 'income', type: 'Income', amountBase: 1000 }, 'create');
  database.put('movement', 'owner', { ...base, id: 'expense', type: 'Expense', amountBase: 300 }, 'create');
  database.put('movement', 'owner', { ...base, id: 'transfer', type: 'Expense', amountBase: 500, operationType: 'Transfer' }, 'create');
  database.put('movement', 'owner', { ...base, id: 'payment', type: 'Expense', amountBase: 200, operationType: 'CreditPayment' }, 'create');
  assert.deepEqual(database.summary('owner', 2026, 7), { totalIncome: 1000, totalExpense: 300, balance: 700, savings: 0, savingsRate: 0, comparedToPreviousMonth: { incomeDelta: 0, expenseDelta: 0 } });
  database.close();
});

test('movement queries honor type and portfolio drill-down filters', () => {
  const { database } = fixture();
  const base = { currency: 'COP', trmApplied: 1, date: '2026-07-12T00:00:00Z', amount: 100, amountBase: 100 };
  database.put('movement', 'owner', { ...base, id: 'income', type: 'Income', accountId: 'asset-1' }, 'create');
  database.put('movement', 'owner', { ...base, id: 'expense', type: 'Expense', accountId: 'asset-2' }, 'create');
  assert.deepEqual(database.movements('owner', { year: 2026, month: 7, type: 'Expense' }).items.map((item) => item.id), ['expense']);
  assert.deepEqual(database.movements('owner', { year: 2026, month: 7, portfolioEntityId: 'asset-1' }).items.map((item) => item.id), ['income']);
  database.close();
});

test('account balances expose native and base-currency positions', () => {
  const { database } = fixture();
  database.put('account', 'owner', { id: 'usd', currency: 'USD', type: 'Debit' }, 'snapshot');
  database.put('movement', 'owner', { id: 'income', accountId: 'usd', type: 'Income', currency: 'USD', amount: 10, trmApplied: 4000, amountBase: 40000, date: '2026-07-12' }, 'create');
  assert.deepEqual(database.accountBalances('owner', ['usd']).usd, {
    balance: 10, balanceBase: 40000, outstandingDebt: 0, outstandingDebtBase: 0,
    cycleSpend: 0, cycleSpendBase: 0, usedInCycle: 0, usedInCycleBase: 0,
  });
  database.close();
});

test('credit-card refunds and payments reduce outstanding debt', () => {
  const { database } = fixture();
  database.put('account', 'owner', { id: 'card', currency: 'COP', type: 'Credit' }, 'snapshot');
  const base = { accountId: 'card', currency: 'COP', trmApplied: 1, date: '2026-07-12', sourceType: 'CreditCard' };
  database.put('movement', 'owner', { ...base, id: 'purchase', type: 'Expense', amount: 500, amountBase: 500, operationType: 'CreditPurchase' }, 'create');
  database.put('movement', 'owner', { ...base, id: 'refund', type: 'Income', amount: 100, amountBase: 100, operationType: 'CreditPurchase' }, 'create');
  database.put('movement', 'owner', { ...base, id: 'payment', type: 'Income', amount: 150, amountBase: 150, operationType: 'CreditPayment' }, 'create');
  const balance = database.accountBalances('owner', ['card'], '2026-07-20').card;
  assert.equal(balance.outstandingDebt, 250);
  assert.equal(balance.usedInCycle, 250);
  database.close();
});

test('credit-card cycle spend respects billing day and excludes payments', () => {
  const { database } = fixture();
  database.put('account', 'owner', { id: 'card', currency: 'COP', type: 'Credit', billingDay: 15 }, 'snapshot');
  const add = (id, date, type, amount, operationType = 'CreditPurchase') => database.put('movement', 'owner', {
    id, accountId: 'card', currency: 'COP', trmApplied: 1, amount, amountBase: amount,
    date, type, sourceType: 'CreditCard', operationType,
  }, 'create');
  add('prior', '2026-07-14', 'Expense', 90);
  add('current', '2026-07-15', 'Expense', 100);
  add('refund', '2026-07-16', 'Income', 20);
  add('payment', '2026-07-17', 'Income', 40, 'CreditPayment');
  const balance = database.accountBalances('owner', ['card'], '2026-08-09').card;
  assert.equal(balance.outstandingDebt, 130);
  assert.equal(balance.cycleSpend, 80);
  database.close();
});

test('local analytics conform to the shared golden financial dataset', () => {
  const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/refactor/fixtures/golden-financial-dataset.json'), 'utf8'));
  for (const scenario of golden.scenarios) {
    const { database } = fixture();
    const base = { currency: 'COP', trmApplied: 1, date: '2026-07-12' };
    let sequence = 0;
    const add = (value) => database.put('movement', 'owner', { ...base, id: `${scenario.id}-${++sequence}`, ...value }, 'snapshot');
    for (const movement of scenario.movements) {
      const amountBase = movement.amountBase ?? Number(movement.amount || 0) * Number(movement.trmApplied || 1);
      if (movement.operation === 'income') add({ type: 'Income', amountBase });
      if (movement.operation === 'expense' || movement.operation === 'creditPurchase') add({ type: 'Expense', amountBase, operationType: movement.operation === 'creditPurchase' ? 'CreditPurchase' : null });
      if (movement.operation === 'transfer') {
        add({ type: 'Expense', amountBase, operationType: movement.purpose === 'Saving' ? 'Saving' : 'Transfer' });
        add({ type: 'Income', amountBase, operationType: movement.purpose === 'Saving' ? 'Saving' : 'Transfer' });
      }
      if (movement.operation === 'creditPayment') {
        add({ type: 'Expense', amountBase, operationType: 'CreditPayment' });
        add({ type: 'Income', amountBase, operationType: 'CreditPayment' });
      }
      if (movement.operation === 'loanDisbursement') add({ type: 'Income', amountBase: movement.principal, operationType: 'LoanDisbursement' });
      if (movement.operation === 'loanPayment') add({ type: 'Expense', amountBase: movement.principal + movement.interest, interestComponent: movement.interest, operationType: 'LoanPayment' });
    }
    const summary = database.summary('owner', 2026, 7);
    if (scenario.expected.income !== undefined) assert.equal(summary.totalIncome, scenario.expected.income, scenario.id);
    if (scenario.expected.operatingIncome !== undefined) assert.equal(summary.totalIncome, scenario.expected.operatingIncome, scenario.id);
    if (scenario.expected.expense !== undefined) assert.equal(summary.totalExpense, scenario.expected.expense, scenario.id);
    if (scenario.expected.paymentExpense !== undefined) assert.equal(summary.totalExpense - (scenario.expected.expense || 0), scenario.expected.paymentExpense, scenario.id);
    if (scenario.expected.saving !== undefined) assert.equal(summary.savings, scenario.expected.saving, scenario.id);
    database.close();
  }
});

test('multi-document financial operations are atomic and survive restart', () => {
  const { database } = fixture();
  database.putMany('movement', 'owner', [
    { id: 'source', type: 'Expense', amountBase: 250, date: '2026-07-12', operationType: 'Transfer' },
    { id: 'target', type: 'Income', amountBase: 250, date: '2026-07-12', operationType: 'Transfer' },
  ], 'transfer');
  assert.equal(database.list('movement', 'owner').length, 2);
  assert.equal(database.outbox('owner').length, 0);
  database.close();
});

test('cross-kind financial operations commit atomically', () => {
  const { database } = fixture();
  database.applyBatch('owner', [
    { action: 'put', kind: 'loan', value: { id: 'loan-1', principal: 500 }, operation: 'loan-create' },
    { action: 'put', kind: 'movement', value: { id: 'loan-disbursement-1', type: 'Income', amountBase: 500, date: '2026-07-12', loanId: 'loan-1' }, operation: 'loan-create' },
  ]);
  assert.equal(database.get('loan', 'owner', 'loan-1').principal, 500);
  assert.equal(database.get('movement', 'owner', 'loan-disbursement-1').loanId, 'loan-1');
  assert.equal(database.outbox('owner').length, 0);
  database.close();
});

test('cross-kind batch validates every action before writing', () => {
  const { database } = fixture();
  assert.throws(() => database.applyBatch('owner', [
    { action: 'put', kind: 'loan', value: { id: 'loan-1', principal: 500 } },
    { action: 'put', kind: 'unsupported', value: { id: 'bad' } },
  ]), /Unsupported local entity kind/);
  assert.equal(database.get('loan', 'owner', 'loan-1'), null);
  database.close();
});

test('network loss and timeout retain the same idempotent outbox change', () => {
  const { database } = fixture(true);
  const result = database.put('movement', 'owner', { id: 'm1', amount: 10 }, 'create');
  database.recordSyncError('owner', 'timeout');
  const pending = database.outbox('owner');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].changeId, result.changeId);
  assert.equal(pending[0].attempts, 1);
  database.close();
});

test('lost response and double send converge through duplicate acknowledgement', () => {
  const { database } = fixture(true);
  const result = database.put('category', 'owner', { id: 'c1', name: 'Food' }, 'create');
  database.recordSyncError('owner', 'response_lost');
  database.recordPushResults('owner', [{ changeId: result.changeId, status: 'duplicate', revision: 'rev-1' }]);
  assert.equal(database.outbox('owner').length, 0);
  assert.equal(database.get('category', 'owner', 'c1').name, 'Food');
  database.close();
});

test('two devices create a visible conflict instead of financial LWW', () => {
  const { database } = fixture(true);
  database.ensureDevice('owner', 'device-a');
  database.put('movement', 'owner', { id: 'm1', amount: 100, amountBase: 100 }, 'update');
  database.applyRemotePage('owner', [{ kind: 'movement', entityId: 'm1', deviceId: 'device-b', revision: 'server-r2', isTombstone: false, document: { id: 'm1', amount: 200, amountBase: 200 } }], 8);
  assert.equal(database.get('movement', 'owner', 'm1').amount, 100);
  assert.equal(database.conflicts('owner').length, 1);
  assert.equal(database.syncStatus('owner').cursor, 8);
  database.close();
});

test('clock skew cannot reorder server-cursor changes', () => {
  const { database } = fixture(true);
  database.ensureDevice('owner', 'device-a');
  database.applyRemotePage('owner', [{ kind: 'account', entityId: 'a1', deviceId: 'device-b', revision: 'r1', isTombstone: false, document: { id: 'a1', name: 'Future clock', updatedAt: '2099-01-01' } }], 10);
  database.applyRemotePage('owner', [{ kind: 'account', entityId: 'a1', deviceId: 'device-b', revision: 'r2', isTombstone: false, document: { id: 'a1', name: 'Server order', updatedAt: '2000-01-01' } }], 11);
  assert.equal(database.get('account', 'owner', 'a1').name, 'Server order');
  assert.equal(database.syncStatus('owner').cursor, 11);
  database.close();
});

test('accepts every aggregate kind currently emitted by the API change feed', () => {
  const { database } = fixture(true);
  const kinds = ['portfolioentity', 'portfoliovaluation', 'investmenttransaction', 'loan', 'budget', 'financialgoal', 'financialoperation', 'installmentpurchase', 'recurringtransaction'];
  database.applyRemotePage('owner', kinds.map((kind, index) => ({
    kind, entityId: `${kind}-1`, deviceId: 'server', revision: `r-${index}`,
    isTombstone: false, document: { id: `${kind}-1`, name: kind },
  })), kinds.length);
  for (const kind of kinds) assert.equal(database.get(kind, 'owner', `${kind}-1`).name, kind);
  assert.equal(database.syncStatus('owner').cursor, kinds.length);
  database.close();
});

test('concurrent remote deletion remains visible until explicit resolution', () => {
  const { database } = fixture(true);
  database.ensureDevice('owner', 'device-a');
  database.put('movement', 'owner', { id: 'm1', amount: 50 }, 'update');
  database.applyRemotePage('owner', [{ kind: 'movement', entityId: 'm1', deviceId: 'device-b', revision: 'deleted-r', isTombstone: true, document: null }], 15);
  const conflict = database.conflicts('owner')[0];
  assert.equal(database.get('movement', 'owner', 'm1').amount, 50);
  database.resolveConflict('owner', conflict.id, 'accept-server');
  assert.equal(database.conflicts('owner').length, 0);
  database.close();
});
