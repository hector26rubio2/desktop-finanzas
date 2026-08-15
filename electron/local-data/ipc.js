const path = require('path');

const CHANNELS = new Set([
  'local:status', 'local:list', 'local:get', 'local:put', 'local:put-many', 'local:batch', 'local:remove',
  'local:movements', 'local:summary', 'local:account-balances', 'local:backup', 'local:backup-preview', 'local:restore',
]);

function registerLocalDataIpc({ ipcMain, database, app }) {
  const handlers = {
    'local:status': () => database.status(),
    'local:list': (_e, entity) => database.list(entity),
    'local:get': (_e, entity, id) => database.get(entity, id),
    'local:put': (_e, entity, value) => database.put(entity, value),
    'local:put-many': (_e, entity, values) => database.putMany(entity, values),
    'local:batch': (_e, operations) => database.applyBatch(operations),
    'local:remove': (_e, entity, id) => database.remove(entity, id),
    'local:movements': (_e, query) => database.movements(query),
    'local:summary': (_e, year, month) => database.summary(year, month),
    'local:account-balances': (_e, ids) => database.accountBalances(ids),
    'local:backup': (_e, destination) => database.backup(destination || path.join(app.getPath('documents'), `finanzas-backup-${Date.now()}.sqlite3`)),
    'local:backup-preview': (_e, source) => database.backupPreview(source),
    'local:restore': (_e, source, expectedCurrentRevision) => database.restore(source, expectedCurrentRevision),
  };
  for (const channel of CHANNELS) ipcMain.handle(channel, handlers[channel]);
  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerLocalDataIpc, CHANNELS };
