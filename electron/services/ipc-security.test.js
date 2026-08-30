const assert = require('node:assert/strict');
const test = require('node:test');
const { createIpcSecurity } = require('./ipc-security');
const { validateArguments, MAX_BATCH_ITEMS } = require('../local-data/ipc');
const { assertAuthPayload, MAX_AUTH_PAYLOAD_BYTES } = require('../local-data/auth-ipc');

function fixture(isDev = false) {
  const mainFrame = { url: isDev ? 'http://localhost:4200/dashboard' : 'http://localhost:4269/dashboard' };
  const webContents = { mainFrame };
  const window = { webContents, isDestroyed: () => false };
  const BrowserWindow = { fromWebContents: (candidate) => (candidate === webContents ? window : null) };
  const security = createIpcSecurity({ BrowserWindow, isDev });
  security.trustWindow(window, isDev ? 'http://localhost:4200' : 'http://localhost:4269');
  return { security, event: { sender: webContents, senderFrame: mainFrame }, mainFrame, webContents };
}

test('trusted top-level renderer is accepted', () => {
  const { security, event } = fixture();
  assert.doesNotThrow(() => security.assertTrustedSender(event));
});

test('subframes, foreign origins and unknown webContents are rejected', () => {
  const { security, event, mainFrame } = fixture();
  assert.throws(() => security.assertTrustedSender({ ...event, senderFrame: { url: mainFrame.url } }), /untrusted/);
  mainFrame.url = 'http://localhost:9999/dashboard';
  assert.throws(() => security.assertTrustedSender(event), /untrusted/);
  assert.throws(() => security.assertTrustedSender({ sender: { mainFrame }, senderFrame: mainFrame }), /untrusted/);
});

test('development renderer is restricted to the Angular development origin', () => {
  const { security, event, mainFrame } = fixture(true);
  assert.doesNotThrow(() => security.assertTrustedSender(event));
  mainFrame.url = 'http://127.0.0.1:4200/';
  assert.throws(() => security.assertTrustedSender(event), /untrusted/);
});

test('local-data IPC rejects oversized and malformed requests before database access', () => {
  assert.throws(() => validateArguments('local:list', ['unknown']), /unsupported/);
  assert.throws(() => validateArguments('local:movements', [{ pageSize: 501 }]), /page_size/);
  assert.throws(
    () => validateArguments('local:put-many', ['movement', Array.from({ length: MAX_BATCH_ITEMS + 1 })]),
    /batch/,
  );
  assert.throws(() => validateArguments('local:restore', ['x.sqlite3', 'not-a-revision']), /revision/);
  assert.doesNotThrow(() => validateArguments('local:summary', [2026, 8]));
});

test('auth IPC rejects payloads large enough to exhaust hashing or serialization', () => {
  assert.throws(
    () => assertAuthPayload('auth:login', [{ password: 'x'.repeat(MAX_AUTH_PAYLOAD_BYTES + 1) }]),
    /too_large/,
  );
  assert.doesNotThrow(() => assertAuthPayload('auth:logout', []));
});
