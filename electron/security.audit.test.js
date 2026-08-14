const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');

test('traffic encryption uses API-compatible IV + tag + ciphertext layout', async () => {
  const previous = process.env.FINANZAS_ENCRYPTION_KEY;
  process.env.FINANZAS_ENCRYPTION_KEY = 'compatibility-test-secret';
  const handlers = new Map();
  const ipcMain = { handle: (name, handler) => handlers.set(name, handler) };
  const safeStorage = { isEncryptionAvailable: () => false };
  const logger = { error() {} };
  const { registerSecurityIpc } = require('./services/security');
  registerSecurityIpc({ ipcMain, safeStorage, logger });
  const plain = JSON.stringify({ ok: true });
  const payload = await handlers.get('crypto:encrypt')(null, plain);
  const raw = Buffer.from(payload, 'base64');
  const key = crypto.pbkdf2Sync(process.env.FINANZAS_ENCRYPTION_KEY, 'finanzas-salt-v2', 600000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const apiPlain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  assert.equal(apiPlain, plain);
  assert.equal(await handlers.get('crypto:decrypt')(null, payload), plain);
  if (previous === undefined) delete process.env.FINANZAS_ENCRYPTION_KEY;
  else process.env.FINANZAS_ENCRYPTION_KEY = previous;
});

test('renderer never receives encryption keys and refresh tokens prefer OS storage', () => {
  const preload = read('preload.js');
  const localIpc = read('local-data/ipc.js');
  const session = read('../src/app/shared/services/auth/session.service.ts');
  assert.doesNotMatch(preload, /encryptionKey\s*:/);
  assert.match(preload, /secureEncrypt/);
  assert.match(session, /parsed\.v === 4/);
  assert.match(session, /secureDecrypt/);
  const syncChannels = /local:(?:apply-remote|push-results|resolve-conflict|outbox|sync-status|conflicts)/;
  assert.doesNotMatch(preload, syncChannels);
  assert.doesNotMatch(localIpc, syncChannels);
});

test('no server is left to call and the profile never leaves the main process', () => {
  const guard = read('../src/app/core/interceptors/local-only-http-guard.interceptor.ts');
  const store = read('local-data/auth-store.js');
  const authIpc = read('local-data/auth-ipc.js');

  // Ninguna URL de API queda configurada en ningún entorno.
  for (const file of ['../src/environments/environment.ts', '../src/environments/environment.prod.ts']) {
    assert.doesNotMatch(read(file), /apiUrl/);
  }
  // `src/assets/` se copia entera a dist/ y de ahí al instalador. Cualquier
  // fichero con secretos ahí se publica: así se filtró `app-config.json`, que
  // llevaba apiUrl, googleClientId y encryptionKey con valores reales.
  const assets = path.resolve(__dirname, '..', 'src', 'assets');
  const assetFiles = fs.existsSync(assets) ? fs.readdirSync(assets, { recursive: true }) : [];
  for (const entry of assetFiles) {
    const file = path.join(assets, String(entry));
    if (!fs.statSync(file).isFile()) continue;
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /encryptionKey|clientSecret|apiUrl|password/i, `secreto publicado en src/assets/${entry}`);
  }
  // El interceptor ya no tiene rama de paso: no hay lista blanca que burlar.
  assert.doesNotMatch(guard, /next\(req\)/);
  // La capa IPC solo delega en el store: no lee el archivo ni compone respuestas.
  assert.doesNotMatch(authIpc, /require\(|fs\./);
  // La contraseña y el código se guardan derivados, nunca en claro.
  assert.match(store, /scryptSync/);
  assert.match(store, /timingSafeEqual/);
  assert.doesNotMatch(store, /password:\s*String\(/);
});

test('local server rejects traversal outside distribution root', () => {
  const server = read('services/local-server.js');
  assert.match(server, /path\.resolve\(root/);
  assert.match(server, /startsWith\(/);
  assert.match(server, /path\.join\(root, 'index\.html'\)/);
});

test('production API samples contain no reusable password', () => {
  const environment = JSON.parse(read('../../api/scripts/finanzas-api.prod-environment.json'));
  const passwords = environment.values.filter((x) => /password/i.test(x.key));
  assert.ok(passwords.length > 0);
  assert.ok(passwords.every((x) => x.value === '' && x.type === 'secret'));
});
