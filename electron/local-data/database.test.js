const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { LocalDatabase } = require('./database');

const logger = { info() {}, warn() {}, error() {} };
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`wrapped:${value}`),
  decryptString: (value) => value.toString().slice('wrapped:'.length),
};

function fixture({ encrypt = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-local-'));
  const app = { getPath: () => root };
  const databasePath = path.join(root, 'data.sqlite3');
  const keyPath = path.join(root, 'data.key');
  const database = new LocalDatabase({
    app,
    logger,
    databasePath,
    keyPath,
    safeStorage: encrypt ? safeStorage : undefined,
  });
  database.open();
  return { root, databasePath, keyPath, database };
}

test('persists relational entities and survives a restart', () => {
  const { database, databasePath, keyPath, root } = fixture();
  assert.equal(database.status().schemaVersion, 1);
  assert.equal(database.status().encryptedPayloads, true);

  database.put('account', { id: 'a1', name: 'Cash', type: 'Cash', currency: 'COP' });
  const movement = {
    id: 'm1',
    type: 'Expense',
    kind: 'Expense',
    accountId: 'a1',
    amount: 100,
    amountBase: 400000,
    currency: 'USD',
    trmApplied: 4000,
    date: '2026-07-12',
    description: 'plain merchant',
  };
  database.put('movement', movement);

  assert.equal(database.movements({ year: 2026, month: 7 }).items[0].amountBase, 400000);
  assert.equal(database.get('movement', 'm1').description, 'plain merchant');
  database.close();

  const reopened = new LocalDatabase({ app: { getPath: () => root }, logger, databasePath, keyPath, safeStorage });
  reopened.open();
  assert.equal(reopened.get('movement', 'm1').description, 'plain merchant');
  reopened.close();
});

test('the insecure Linux basic_text backend cannot protect the database key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-local-insecure-'));
  const keyPath = path.join(root, 'data.key');
  const database = new LocalDatabase({
    app: { getPath: () => root },
    logger,
    databasePath: path.join(root, 'data.sqlite3'),
    keyPath,
    safeStorage: { ...safeStorage, getSelectedStorageBackend: () => 'basic_text' },
  });
  assert.throws(() => database.open(), /credential store is insecure/);
  assert.equal(fs.existsSync(keyPath), false);
});

test('rejects invalid and implausible interest rates at the data boundary', () => {
  const { database, root } = fixture();
  assert.throws(
    () =>
      database.put('account', {
        id: 'invalid-rate',
        name: 'Invalid card',
        type: 'Credit',
        currency: 'COP',
        interestRate: 213213,
      }),
    /interestRate_must_be_between_0_and_1000/,
  );
  assert.throws(
    () =>
      database.put('loan', {
        id: 'negative-rate',
        description: 'Invalid loan',
        principal: 100,
        currency: 'COP',
        interestRateAnnual: -1,
        termMonths: 1,
        startDate: '2026-08-01',
      }),
    /interestRateAnnual_must_be_between_0_and_1000/,
  );
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('database and backups are encrypted at rest with an OS-protected key', () => {
  const { database, databasePath, root } = fixture();
  database.put('account', { id: 'a1', name: 'Cash', type: 'Cash', currency: 'COP' });
  database.put('movement', {
    id: 'm1',
    type: 'Expense',
    kind: 'Expense',
    accountId: 'a1',
    amount: 5,
    amountBase: 5,
    currency: 'COP',
    trmApplied: 1,
    date: '2026-07-12',
    description: 'clear-text merchant',
  });
  const backup = path.join(root, 'peek.sqlite3');
  const result = database.backup(backup);
  assert.equal(result.encrypted, true);
  assert.equal(fs.readFileSync(databasePath).includes(Buffer.from('clear-text merchant')), false);
  assert.equal(fs.readFileSync(backup).includes(Buffer.from('clear-text merchant')), false);
  const withoutKey = new Database(backup, { readonly: true });
  assert.throws(() => withoutKey.prepare('SELECT COUNT(*) FROM movements').get());
  withoutKey.close();
  database.close();
});

test('a legacy plaintext database is migrated to encryption without losing data', () => {
  const legacy = fixture({ encrypt: false });
  legacy.database.put('account', { id: 'legacy', name: 'Legacy cash', type: 'Cash', currency: 'COP' });
  legacy.database.close();
  assert.equal(fs.readFileSync(legacy.databasePath).includes(Buffer.from('Legacy cash')), true);

  const migrated = new LocalDatabase({
    app: { getPath: () => legacy.root },
    logger,
    databasePath: legacy.databasePath,
    keyPath: legacy.keyPath,
    safeStorage,
  });
  migrated.open();
  assert.equal(migrated.status().encryptedPayloads, true);
  assert.equal(migrated.get('account', 'legacy').name, 'Legacy cash');
  migrated.close();
  assert.equal(fs.readFileSync(legacy.databasePath).includes(Buffer.from('Legacy cash')), false);
});

test('migration neutralizes legacy interest rates outside the supported range', () => {
  const legacy = fixture({ encrypt: false });
  legacy.database.put('account', { id: 'card', name: 'Card', type: 'Credit', currency: 'COP', interestRate: 10 });
  legacy.database.put('loan', {
    id: 'loan',
    description: 'Loan',
    principal: 100,
    currency: 'COP',
    interestRateAnnual: 12,
    termMonths: 1,
    startDate: '2026-08-01',
  });
  legacy.database.close();
  const raw = new Database(legacy.databasePath);
  raw.prepare('UPDATE accounts SET interest_rate = 213213 WHERE id = ?').run('card');
  raw.prepare('UPDATE loans SET interest_rate_annual = -1 WHERE id = ?').run('loan');
  raw.close();

  const migrated = new LocalDatabase({
    app: { getPath: () => legacy.root },
    logger,
    databasePath: legacy.databasePath,
    keyPath: legacy.keyPath,
    safeStorage,
  });
  migrated.open();
  assert.equal(migrated.get('account', 'card').interestRate, null);
  assert.equal(migrated.get('loan', 'loan').interestRateAnnual, 0);
  migrated.close();
});

test('list, get and remove operate per entity', () => {
  const { database } = fixture();
  database.put('account', { id: 'a1', name: 'Cash', type: 'Cash', currency: 'COP' });
  database.put('movement', {
    id: 'm1',
    type: 'Expense',
    kind: 'Expense',
    amount: 20,
    amountBase: 20,
    currency: 'COP',
    trmApplied: 1,
    date: '2026-07-01',
  });
  assert.equal(database.get('account', 'a1').name, 'Cash');
  assert.equal(database.remove('movement', 'm1'), true);
  assert.equal(database.list('movement').length, 0);
  database.close();
});

test('backup and validated restore recover the prior state', () => {
  const { root, database } = fixture();
  database.put('account', { id: 'a1', name: 'Cash', type: 'Cash', currency: 'COP' });
  database.put('movement', {
    id: 'm1',
    type: 'Income',
    kind: 'Income',
    amount: 1,
    amountBase: 1,
    currency: 'COP',
    trmApplied: 1,
    date: '2026-07-01',
  });
  const backup = path.join(root, 'backup.sqlite3');
  database.backup(backup);
  database.put('account', { id: 'a2', name: 'Bank', type: 'Debit', currency: 'COP' });
  assert.equal(database.list('account').length, 2);
  const preview = database.backupPreview(backup);
  database.restore(backup, preview.currentRevision);
  assert.deepEqual(
    database.list('account').map((x) => x.id),
    ['a1'],
  );
  database.close();
});

test('backup chooses a protected local destination when none is provided', () => {
  const { root, database } = fixture();
  database.put('account', { id: 'a1', name: 'Cash', type: 'Cash', currency: 'COP' });
  const result = database.backup();
  assert.equal(path.dirname(result.path), path.join(root, 'backups'));
  assert.match(path.basename(result.path), /^finanzas-backup-.*\.sqlite3$/);
  assert.equal(fs.existsSync(result.path), true);
  database.close();
});

test('backup never overwrites an existing file and rejects invalid restore sources', () => {
  const { root, database } = fixture();
  const destination = path.join(root, 'existing.sqlite3');
  fs.writeFileSync(destination, 'keep-me');
  assert.throws(() => database.backup(destination), /backup_destination_exists/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'keep-me');
  assert.throws(() => database.backupPreview(path.join(root, 'missing.sqlite3')), /backup_file_not_found/);
  database.close();
});

test('summary excludes transfers and card payments from income and expense', () => {
  const { database } = fixture();
  const base = { currency: 'COP', trmApplied: 1, date: '2026-07-12', amount: 0 };
  database.put('movement', { ...base, id: 'income', type: 'Income', kind: 'Income', amountBase: 1000 });
  database.put('movement', { ...base, id: 'expense', type: 'Expense', kind: 'Expense', amountBase: 300 });
  database.put('movement', { ...base, id: 'transfer', type: 'Expense', kind: 'Transfer', amountBase: 500 });
  database.put('movement', { ...base, id: 'payment', type: 'Income', kind: 'CreditPayment', amountBase: 200 });
  assert.deepEqual(database.summary(2026, 7), {
    totalIncome: 1000,
    totalExpense: 300,
    balance: 700,
    savings: 0,
    savingsRate: 0,
    comparedToPreviousMonth: { incomeDelta: 0, expenseDelta: 0 },
  });
  database.close();
});

test('movement queries honor type and portfolio drill-down filters', () => {
  const { database } = fixture();
  database.put('account', { id: 'asset-1', name: 'A', type: 'Debit', currency: 'COP' });
  database.put('account', { id: 'asset-2', name: 'B', type: 'Debit', currency: 'COP' });
  const base = { currency: 'COP', trmApplied: 1, date: '2026-07-12', amount: 100, amountBase: 100 };
  database.put('movement', { ...base, id: 'income', type: 'Income', kind: 'Income', accountId: 'asset-1' });
  database.put('movement', { ...base, id: 'expense', type: 'Expense', kind: 'Expense', accountId: 'asset-2' });
  assert.deepEqual(
    database.movements({ year: 2026, month: 7, type: 'Expense' }).items.map((i) => i.id),
    ['expense'],
  );
  assert.deepEqual(
    database.movements({ year: 2026, month: 7, portfolioEntityId: 'asset-1' }).items.map((i) => i.id),
    ['income'],
  );
  database.close();
});

test('account balances expose native and base-currency positions', () => {
  const { database } = fixture();
  database.put('account', { id: 'usd', name: 'USD', currency: 'USD', type: 'Debit' });
  database.put('movement', {
    id: 'income',
    accountId: 'usd',
    type: 'Income',
    kind: 'Income',
    currency: 'USD',
    amount: 10,
    trmApplied: 4000,
    amountBase: 40000,
    date: '2026-07-12',
  });
  assert.deepEqual(database.accountBalances(['usd']).usd, {
    balance: 10,
    balanceBase: 40000,
    outstandingDebt: 0,
    outstandingDebtBase: 0,
    cycleSpend: 0,
    cycleSpendBase: 0,
    usedInCycle: 0,
    usedInCycleBase: 0,
  });
  database.close();
});

test('credit-card refunds and payments reduce outstanding debt', () => {
  const { database } = fixture();
  database.put('account', { id: 'card', name: 'Card', currency: 'COP', type: 'Credit' });
  const base = { accountId: 'card', currency: 'COP', trmApplied: 1, date: '2026-07-12', sourceType: 'CreditCard' };
  database.put('movement', {
    ...base,
    id: 'purchase',
    type: 'Expense',
    kind: 'CreditPurchase',
    amount: 500,
    amountBase: 500,
  });
  database.put('movement', {
    ...base,
    id: 'refund',
    type: 'Income',
    kind: 'CreditPurchase',
    amount: 100,
    amountBase: 100,
  });
  database.put('movement', {
    ...base,
    id: 'payment',
    type: 'Income',
    kind: 'CreditPayment',
    amount: 150,
    amountBase: 150,
  });
  const balance = database.accountBalances(['card'], '2026-07-20').card;
  assert.equal(balance.outstandingDebt, 250);
  assert.equal(balance.usedInCycle, 250);
  database.close();
});

test('credit-card cycle spend respects billing day and excludes payments', () => {
  const { database } = fixture();
  database.put('account', { id: 'card', name: 'Card', currency: 'COP', type: 'Credit', billingDay: 15 });
  const add = (id, date, type, amount, kind = 'CreditPurchase') =>
    database.put('movement', {
      id,
      accountId: 'card',
      currency: 'COP',
      trmApplied: 1,
      amount,
      amountBase: amount,
      date,
      type,
      kind,
      sourceType: 'CreditCard',
    });
  add('prior', '2026-07-14', 'Expense', 90);
  add('current', '2026-07-15', 'Expense', 100);
  add('refund', '2026-07-16', 'Income', 20);
  add('payment', '2026-07-17', 'Income', 40, 'CreditPayment');
  const balance = database.accountBalances(['card'], '2026-08-09').card;
  assert.equal(balance.outstandingDebt, 130);
  assert.equal(balance.cycleSpend, 80);
  database.close();
});

test('cross-entity operations commit atomically through applyBatch', () => {
  const { database } = fixture();
  database.applyBatch([
    {
      action: 'put',
      kind: 'loan',
      value: {
        id: 'loan-1',
        description: 'Loan',
        principal: 500,
        currency: 'COP',
        interestRateAnnual: 10,
        termMonths: 12,
        startDate: '2026-07-01',
      },
    },
    {
      action: 'put',
      kind: 'movement',
      value: {
        id: 'disb-1',
        type: 'Income',
        kind: 'LoanReceived',
        amount: 500,
        amountBase: 500,
        currency: 'COP',
        trmApplied: 1,
        date: '2026-07-12',
        loanId: 'loan-1',
      },
    },
  ]);
  assert.equal(database.get('loan', 'loan-1').principal, 500);
  assert.equal(database.get('movement', 'disb-1').loanId, 'loan-1');
  database.close();
});

test('applyBatch validates every action before writing', () => {
  const { database } = fixture();
  assert.throws(
    () =>
      database.applyBatch([
        {
          action: 'put',
          kind: 'loan',
          value: {
            id: 'loan-x',
            description: 'L',
            principal: 1,
            currency: 'COP',
            interestRateAnnual: 1,
            termMonths: 1,
            startDate: '2026-07-01',
          },
        },
        { action: 'put', kind: 'unsupported', value: { id: 'bad' } },
      ]),
    /Unsupported local entity kind/,
  );
  assert.equal(database.get('loan', 'loan-x'), null);
  database.close();
});

test('putMany writes a batch of movements atomically', () => {
  const { database } = fixture();
  database.putMany('movement', [
    {
      id: 'source',
      type: 'Expense',
      kind: 'Transfer',
      amount: 250,
      amountBase: 250,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-07-12',
    },
    {
      id: 'target',
      type: 'Income',
      kind: 'Transfer',
      amount: 250,
      amountBase: 250,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-07-12',
    },
  ]);
  assert.equal(database.list('movement').length, 2);
  database.close();
});
