const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');

test('the main process exposes no traffic encryption and derives no key from the environment', () => {
  const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1');
  const security = withoutComments(read('services/security.js'));
  const preload = withoutComments(read('preload.js'));

  for (const channel of ['crypto:encrypt', 'crypto:decrypt']) {
    assert.doesNotMatch(security, new RegExp(channel.replace(':', '\\:')), `${channel} sigue registrado`);
    assert.doesNotMatch(preload, new RegExp(channel.replace(':', '\\:')), `${channel} sigue expuesto al renderer`);
  }
  assert.doesNotMatch(security, /FINANZAS_ENCRYPTION_KEY|pbkdf2/);
  assert.doesNotMatch(preload, /cryptoEncrypt|cryptoDecrypt/);

  const main = withoutComments(read('main.js'));
  assert.doesNotMatch(main, /loadEnvironment|readFileSync/, 'main.js vuelve a cargar un fichero de entorno');
  assert.doesNotMatch(
    withoutComments(read('../electron-builder.yml')),
    /\.env/,
    'el instalador vuelve a empaquetar un .env',
  );
  assert.match(security, /safeStorage\.encryptString/);
  assert.match(security, /safeStorage\.decryptString/);
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
  const appConfig = read('../src/app/app.config.ts');
  const store = read('local-data/auth-store.js');
  const authIpc = read('local-data/auth-ipc.js');

  for (const file of ['../src/environments/environment.ts', '../src/environments/environment.prod.ts']) {
    assert.doesNotMatch(read(file), /apiUrl/);
  }

  for (const relativeRoot of ['src/assets', 'public']) {
    const root = path.resolve(__dirname, '..', relativeRoot);
    const files = fs.existsSync(root) ? fs.readdirSync(root, { recursive: true }) : [];
    for (const entry of files) {
      const file = path.join(root, String(entry));
      if (!fs.statSync(file).isFile()) continue;
      assert.doesNotMatch(
        fs.readFileSync(file, 'utf8'),
        /encryptionKey|clientSecret|apiUrl|password/i,
        `configuración sensible publicada en ${relativeRoot}/${entry}`,
      );
    }
  }
  assert.doesNotMatch(appConfig, /provideHttpClient/);
  assert.doesNotMatch(authIpc, /require\(|fs\./);
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

test('browser navigation and every privileged IPC surface reject untrusted documents', () => {
  const windowService = read('services/window.js');
  const ipcSecurity = read('services/ipc-security.js');
  const localIpc = read('local-data/ipc.js');
  const authIpc = read('local-data/auth-ipc.js');
  const securityIpc = read('services/security.js');
  const updaterIpc = read('services/updater.js');
  const dialogsIpc = read('services/dialogs.js');
  const main = read('main.js');
  assert.match(windowService, /will-navigate/);
  assert.match(windowService, /preventDefault/);
  assert.match(windowService, /will-attach-webview/);
  assert.match(ipcSecurity, /senderFrame/);
  assert.match(ipcSecurity, /mainFrame/);
  assert.match(ipcSecurity, /trustedOrigins/);
  for (const source of [localIpc, authIpc, securityIpc, updaterIpc, dialogsIpc, main])
    assert.match(source, /assertTrustedSender/);
});

test('the database uses an OS-protected key and encrypted backups', () => {
  const database = read('local-data/database.js');
  assert.match(database, /safeStorage\.encryptString/);
  assert.match(database, /safeStorage\.decryptString/);
  assert.match(database, /cipher = 'chacha20'/);
  assert.match(database, /\.rekey\(key\)/);
  assert.match(database, /encryptedPayloads: this\.encrypted/);
  assert.doesNotMatch(read('preload.js'), /finanzas\.key|databaseKey|encryptionKey/);
});
