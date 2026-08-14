const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');

// Antes había aquí una prueba de interoperabilidad byte a byte entre el cifrado
// de tráfico y el AesGcmEncryptionService de C#. Se retiró con los canales
// `crypto:*`: sin servidor no hay tráfico que cifrar, y mantener el canal vivo
// solo para conservar la prueba dejaba abierta una superficie IPC que nadie usa
// y un uso nominal de una clave que llegó a publicarse.
test('the main process exposes no traffic encryption and derives no key from the environment', () => {
  // Se juzga el código, no los comentarios: el propio comentario que documenta
  // la retirada nombra los canales y la variable que ya no se usan.
  const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1');
  const security = withoutComments(read('services/security.js'));
  const preload = withoutComments(read('preload.js'));

  for (const channel of ['crypto:encrypt', 'crypto:decrypt']) {
    assert.doesNotMatch(security, new RegExp(channel.replace(':', '\\:')), `${channel} sigue registrado`);
    assert.doesNotMatch(preload, new RegExp(channel.replace(':', '\\:')), `${channel} sigue expuesto al renderer`);
  }
  assert.doesNotMatch(security, /FINANZAS_ENCRYPTION_KEY|pbkdf2/);
  assert.doesNotMatch(preload, /cryptoEncrypt|cryptoDecrypt/);

  // Ni se cargan ficheros de secretos ni se empaquetan en el distribuible.
  // `process.env.NODE_ENV` es legítimo: lo pone el script, no un fichero.
  const main = withoutComments(read('main.js'));
  assert.doesNotMatch(main, /loadEnvironment|readFileSync/, 'main.js vuelve a cargar un fichero de entorno');
  assert.doesNotMatch(withoutComments(read('../electron-builder.yml')), /\.env/, 'el instalador vuelve a empaquetar un .env');
  // Lo que sí debe seguir: el cifrado del sistema operativo para la sesión.
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
