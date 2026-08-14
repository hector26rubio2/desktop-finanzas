const assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  test = require('node:test');
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
  const databasePath = path.join(root, 'finanzas.sqlite3'),
    app = { getPath: () => root },
    db = new LocalDatabase({ app, safeStorage, logger, databasePath, syncEnabled: false });
  db.open();
  const auth = new LocalAuthStore({ app, safeStorage, logger, profilePath: path.join(root, 'profile.dat') });
  return { root, databasePath, db, auth };
}
// El ownerId de todo el libro es el id del perfil local. Si cambiara al cambiar
// la contraseña o al recuperar el acceso, los movimientos quedarían huérfanos y
// la aplicación arrancaría vacía sobre datos que siguen en el disco.
test('release journey: local profile owns the ledger across password change and recovery', () => {
  const f = start();
  const enrollment = f.auth.register({ name: 'Titular', email: 'titular@local', password: 'contrasena1', baseCurrency: 'COP', existingOwners: f.db.owners() });
  const owner = enrollment.ownerId;

  f.db.put('movement', owner, { id: 'e2e-1', type: 'Expense', amount: 120, amountBase: 120, currency: 'COP', trmApplied: 1, date: '2026-07-05' }, 'create');
  assert.equal(f.db.list('movement', owner).length, 1);

  // Reinicio: se entra con la contraseña y el libro sigue siendo el mismo.
  f.db.close();
  const restarted = start(f.root);
  assert.equal(restarted.auth.status().hasProfile, true);
  assert.equal(restarted.auth.login({ password: 'contrasena1' }).ownerId, owner);
  assert.equal(restarted.db.list('movement', owner).length, 1);

  // Cambio de contraseña: la identidad no se mueve.
  restarted.auth.changePassword({ currentPassword: 'contrasena1', newPassword: 'contrasena2' });
  assert.equal(restarted.auth.login({ password: 'contrasena2' }).ownerId, owner);

  // Recuperación con el código: tampoco.
  const recovered = restarted.auth.recover({ recoveryCode: enrollment.recoveryCode, newPassword: 'contrasena3' });
  assert.equal(recovered.ownerId, owner);
  assert.equal(restarted.db.get('movement', owner, 'e2e-1').amountBase, 120);
  restarted.db.close();
});

// El caso real de la migración: la base ya tiene datos del API viejo y todavía
// no hay perfil. Si el alta acuñara un id nuevo, la app abriría vacía.
test('release journey: upgrading over API-era data keeps the ledger visible', () => {
  const f = start();
  const legacyOwner = 'b3b04c8b-1697-4705-8b10-3fb4517d8b6f';
  f.db.put('movement', legacyOwner, { id: 'old-1', type: 'Expense', amount: 50, amountBase: 50, currency: 'COP', trmApplied: 1, date: '2026-06-10' }, 'create');
  f.db.put('account', legacyOwner, { id: 'old-account', name: 'Efectivo', type: 'Cash', currency: 'COP', isActive: true }, 'create');

  const owners = f.db.owners();
  assert.equal(owners.length, 1);
  assert.equal(owners[0].ownerId, legacyOwner);

  const enrollment = f.auth.register({ name: 'Titular', password: 'contrasena1', baseCurrency: 'COP', existingOwners: owners });

  assert.equal(enrollment.ownerId, legacyOwner);
  assert.equal(f.db.list('movement', enrollment.ownerId).length, 1);
  assert.equal(f.db.summary(enrollment.ownerId, 2026, 6).totalExpense, 50);
  f.db.close();
});

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
