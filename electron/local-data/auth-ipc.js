const CHANNELS = new Set(['auth:status', 'auth:register', 'auth:login', 'auth:resume', 'auth:logout', 'auth:change-password', 'auth:recover', 'auth:update-profile']);

function registerAuthIpc({ ipcMain, store, database }) {
  // Los dueños salen de SQLite, no del renderer: quién posee un documento no es
  // algo que la interfaz pueda afirmar.
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
  for (const channel of CHANNELS) ipcMain.handle(channel, handlers[channel]);
  return () => { for (const channel of CHANNELS) ipcMain.removeHandler(channel); };
}

module.exports = { registerAuthIpc, CHANNELS };
