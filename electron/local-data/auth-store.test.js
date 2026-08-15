const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { LocalAuthStore } = require('./auth-store');

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`wrapped:${value}`),
  decryptString: (value) => value.toString().slice('wrapped:'.length),
};
const logger = { info() {}, warn() {}, error() {} };

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-auth-'));
  const profilePath = path.join(root, 'profile.dat');
  const store = new LocalAuthStore({ app: { getPath: () => root }, safeStorage, logger, profilePath, ...overrides });
  return { root, profilePath, store };
}

const CREDENTIALS = { name: 'Hector', email: 'Hector@Local', password: 'contrasena1', baseCurrency: 'cop' };

test('the first launch has no profile and suggests the system account name', () => {
  const { store } = fixture();
  const status = store.status();
  assert.equal(status.hasProfile, false);
  assert.equal(status.unlocked, false);
  assert.equal(status.suggestedName, os.userInfo().username);
});

test('registering opens a session, normalizes the profile and issues a recovery code', () => {
  const { store, profilePath } = fixture();
  const enrollment = store.register(CREDENTIALS);

  assert.equal(enrollment.user.name, 'Hector');
  assert.equal(enrollment.user.email, 'hector@local');
  assert.equal(enrollment.user.baseCurrency, 'COP');
  assert.equal(enrollment.ownerId, enrollment.user.id);

  assert.equal(enrollment.resumeToken, null);
  assert.match(enrollment.recoveryCode, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/);

  assert.equal(store.status().hasProfile, true);
  assert.equal(store.status().unlocked, true);

  const stored = fs.readFileSync(profilePath);
  assert.equal(stored.includes(Buffer.from(CREDENTIALS.password)), false);
  assert.equal(stored.includes(Buffer.from(enrollment.recoveryCode)), false);
});

test('the profile adopts the only owner already holding data', () => {
  const { store } = fixture();
  const existingOwners = [{ ownerId: 'b3b04c8b-1697-4705-8b10-3fb4517d8b6f', documents: 73 }];

  assert.deepEqual(store.status(existingOwners).orphanOwners, existingOwners);

  const enrollment = store.register({ ...CREDENTIALS, existingOwners });
  assert.equal(enrollment.ownerId, 'b3b04c8b-1697-4705-8b10-3fb4517d8b6f');

  assert.equal(store.login({ password: CREDENTIALS.password }).ownerId, 'b3b04c8b-1697-4705-8b10-3fb4517d8b6f');

  assert.deepEqual(store.status(existingOwners).orphanOwners, []);
});

test('with no previous data the profile mints its own owner id', () => {
  const { store } = fixture();
  const enrollment = store.register({ ...CREDENTIALS, existingOwners: [] });
  assert.match(enrollment.ownerId, /^[0-9a-f-]{36}$/);
});

test('with several owners it refuses to guess whose the data is', () => {
  const { store } = fixture();
  const existingOwners = [{ ownerId: 'owner-a', documents: 40 }, { ownerId: 'owner-b', documents: 5 }];

  assert.throws(() => store.register({ ...CREDENTIALS, existingOwners }), /more than one owner/);
  assert.equal(store.status(existingOwners).hasProfile, false);

  assert.throws(
    () => store.register({ ...CREDENTIALS, existingOwners, adoptOwnerId: 'owner-c' }),
    /no data on this machine/,
  );
  assert.equal(store.register({ ...CREDENTIALS, existingOwners, adoptOwnerId: 'owner-b' }).ownerId, 'owner-b');
});

test('a second profile cannot be created over an existing one', () => {
  const { store } = fixture();
  store.register(CREDENTIALS);
  assert.throws(() => store.register({ ...CREDENTIALS, name: 'Otro' }), /already exists/);
});

test('registration refuses a password shorter than the minimum', () => {
  const { store } = fixture();
  assert.throws(() => store.register({ ...CREDENTIALS, password: 'corta1' }), /8 characters/);
  assert.equal(store.status().hasProfile, false);
});

test('login accepts the right password and rejects a wrong one', () => {
  const { store } = fixture();
  const registered = store.register(CREDENTIALS);

  assert.throws(() => store.login({ password: 'contrasena2' }), /Incorrect credentials/);

  const session = store.login({ password: CREDENTIALS.password });
  assert.equal(session.ownerId, registered.ownerId);
  assert.equal(session.resumeToken, null);
});

test('sign-in pauses after five failed attempts', () => {
  const { store } = fixture();
  store.register(CREDENTIALS);
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.throws(() => store.login({ password: 'incorrecta' }), /Incorrect credentials/);
  }

  assert.throws(() => store.login({ password: CREDENTIALS.password }), /Too many attempts/);
});

test('remembering the session issues a token that reopens it and dies on logout', () => {
  const { store } = fixture();
  store.register(CREDENTIALS);
  const session = store.login({ password: CREDENTIALS.password, remember: true });
  assert.equal(typeof session.resumeToken, 'string');

  assert.equal(store.resume(session.resumeToken).ownerId, session.ownerId);
  assert.equal(store.resume('otro-token'), null);

  store.logout();
  assert.equal(store.resume(session.resumeToken), null);
});

test('changing the password invalidates the remembered session', () => {
  const { store } = fixture();
  store.register(CREDENTIALS);
  const session = store.login({ password: CREDENTIALS.password, remember: true });

  assert.throws(() => store.changePassword({ currentPassword: 'incorrecta', newPassword: 'nueva12345' }), /incorrect/);
  store.changePassword({ currentPassword: CREDENTIALS.password, newPassword: 'nueva12345' });

  assert.equal(store.resume(session.resumeToken), null);
  assert.throws(() => store.login({ password: CREDENTIALS.password }), /Incorrect credentials/);
  assert.equal(store.login({ password: 'nueva12345' }).ownerId, session.ownerId);
});

test('the recovery code restores access once and is replaced by a new one', () => {
  const { store } = fixture();
  const enrollment = store.register(CREDENTIALS);

  assert.throws(() => store.recover({ recoveryCode: 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', newPassword: 'nueva12345' }), /Incorrect credentials/);

  const recovered = store.recover({ recoveryCode: enrollment.recoveryCode.toLowerCase().replace(/-/g, ' '), newPassword: 'nueva12345' });
  assert.equal(recovered.ownerId, enrollment.ownerId);
  assert.notEqual(recovered.recoveryCode, enrollment.recoveryCode);

  assert.equal(store.login({ password: 'nueva12345' }).ownerId, enrollment.ownerId);

  assert.throws(() => store.recover({ recoveryCode: enrollment.recoveryCode, newPassword: 'otra12345' }), /Incorrect credentials/);
});

test('an unreadable profile fails closed instead of offering a fresh signup', () => {
  const { store, profilePath } = fixture();
  store.register(CREDENTIALS);
  fs.writeFileSync(profilePath, Buffer.from('basura-que-no-descifra'));

  assert.throws(() => store.status(), /unreadable/);
  assert.throws(() => store.register(CREDENTIALS), /unreadable/);
});

test('without OS encryption nothing is stored unprotected', () => {
  const unavailable = { ...safeStorage, isEncryptionAvailable: () => false };
  const { store, profilePath } = fixture({ safeStorage: unavailable });
  assert.throws(() => store.register(CREDENTIALS), /OS encryption is unavailable/);
  assert.equal(fs.existsSync(profilePath), false);
});
