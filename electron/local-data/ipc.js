const path = require('path');

const CHANNELS = new Set(['local:status', 'local:list', 'local:get', 'local:put', 'local:put-many', 'local:batch', 'local:remove', 'local:movements', 'local:summary', 'local:account-balances', 'local:backup', 'local:backup-preview', 'local:restore']);

function registerLocalDataIpc({ ipcMain, database, app }) {
  const handlers = {
    'local:status': () => database.status(),
    'local:list': (_e, kind, ownerId) => database.list(kind, ownerId),
    'local:get': (_e, kind, ownerId, id) => database.get(kind, ownerId, id),
    'local:put': (_e, kind, ownerId, value, operation) => database.put(kind, ownerId, value, operation),
    'local:put-many': (_e, kind, ownerId, values, operation) => database.putMany(kind, ownerId, values, operation),
    'local:batch': (_e, ownerId, operations) => database.applyBatch(ownerId, operations),
    'local:remove': (_e, kind, ownerId, id) => database.remove(kind, ownerId, id),
    'local:movements': (_e, ownerId, query) => database.movements(ownerId, query),
    'local:summary': (_e, ownerId, year, month) => database.summary(ownerId, year, month),
    'local:account-balances': (_e, ownerId, ids) => database.accountBalances(ownerId, ids),
    'local:backup': (_e, destination) => database.backup(destination || path.join(app.getPath('documents'), `finanzas-backup-${Date.now()}.sqlite3`)),
    'local:backup-preview': (_e, source) => database.backupPreview(source),
    'local:restore': (_e, source, expectedCurrentRevision) => database.restore(source, expectedCurrentRevision),
  };
  for (const channel of CHANNELS) ipcMain.handle(channel, handlers[channel]);
  return () => { for (const channel of CHANNELS) ipcMain.removeHandler(channel); };
}

module.exports = { registerLocalDataIpc, CHANNELS };
