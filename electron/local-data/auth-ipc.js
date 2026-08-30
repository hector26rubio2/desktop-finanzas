const CHANNELS = new Set([
  'auth:status',
  'auth:register',
  'auth:login',
  'auth:resume',
  'auth:logout',
  'auth:change-password',
  'auth:recover',
  'auth:update-profile',
]);
const MAX_AUTH_PAYLOAD_BYTES = 16_384;

function assertAuthPayload(channel, args) {
  if (channel === 'auth:status' || channel === 'auth:logout') return;
  let payload;
  try {
    payload = JSON.stringify(args);
  } catch {
    throw new Error('invalid_auth_payload');
  }
  if (Buffer.byteLength(payload || '') > MAX_AUTH_PAYLOAD_BYTES) throw new Error('auth_payload_too_large');
}

function registerAuthIpc({ ipcMain, store, database, assertTrustedSender }) {
  if (typeof assertTrustedSender !== 'function') throw new TypeError('assertTrustedSender is required');
  const owners = () => {
    try {
      return database ? database.owners() : [];
    } catch {
      return [];
    }
  };

  const handlers = {
    'auth:status': () => store.status(owners()),
    'auth:register': (_e, payload) => store.register({ ...(payload || {}), existingOwners: owners() }),
    'auth:login': (_e, payload) => store.login(payload || {}),
    'auth:resume': (_e, resumeToken) => store.resume(resumeToken),
    'auth:logout': () => store.logout(),
    'auth:change-password': (_e, payload) => store.changePassword(payload || {}),
    'auth:recover': (_e, payload) => store.recover(payload || {}),
    'auth:update-profile': (_e, patch) => store.updateProfile(patch || {}),
  };
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event);
      assertAuthPayload(channel, args);
      return handlers[channel](event, ...args);
    });
  }
  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerAuthIpc, CHANNELS, assertAuthPayload, MAX_AUTH_PAYLOAD_BYTES };
