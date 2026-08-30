const path = require('path');

const CHANNELS = new Set([
  'local:status',
  'local:list',
  'local:get',
  'local:put',
  'local:put-many',
  'local:batch',
  'local:remove',
  'local:movements',
  'local:summary',
  'local:account-balances',
  'local:backup',
  'local:backup-preview',
  'local:restore',
]);
const ENTITIES = new Set([
  'movement',
  'account',
  'category',
  'loan',
  'installmentpurchase',
  'recurringtransaction',
  'portfolioentity',
  'portfoliovaluation',
  'investmenttransaction',
  'creditcardterms',
]);
const MAX_BATCH_ITEMS = 5000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

function assertEntity(entity) {
  if (!ENTITIES.has(String(entity).toLowerCase())) throw new Error('unsupported_local_entity');
}

function assertPath(value, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return;
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new Error('invalid_local_path');
}

function assertPayloadSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('invalid_local_payload');
  }
  if (Buffer.byteLength(serialized || '') > MAX_PAYLOAD_BYTES) throw new Error('local_payload_too_large');
}

function validateArguments(channel, args) {
  if (['local:list', 'local:get', 'local:put', 'local:put-many', 'local:remove'].includes(channel)) {
    assertEntity(args[0]);
  }
  if (['local:get', 'local:remove'].includes(channel)) {
    if (typeof args[1] !== 'string' || args[1].length === 0 || args[1].length > 256)
      throw new Error('invalid_local_id');
  }
  if (channel === 'local:put') {
    if (!args[1] || typeof args[1] !== 'object' || Array.isArray(args[1])) throw new Error('invalid_local_document');
    assertPayloadSize(args[1]);
  }
  if (channel === 'local:put-many') {
    if (!Array.isArray(args[1]) || args[1].length > MAX_BATCH_ITEMS) throw new Error('invalid_local_batch');
    assertPayloadSize(args[1]);
  }
  if (channel === 'local:batch') {
    if (!Array.isArray(args[0]) || args[0].length === 0 || args[0].length > MAX_BATCH_ITEMS)
      throw new Error('invalid_local_batch');
    assertPayloadSize(args[0]);
  }
  if (channel === 'local:movements') {
    const query = args[0];
    if (query !== undefined && (!query || typeof query !== 'object' || Array.isArray(query)))
      throw new Error('invalid_movement_query');
    if (Number(query?.pageSize || 20) > 500 || Number(query?.pageSize || 20) < 1)
      throw new Error('invalid_movement_page_size');
  }
  if (channel === 'local:summary') {
    const [year, month] = args.map(Number);
    if (!Number.isInteger(year) || year < 1900 || year > 3000 || !Number.isInteger(month) || month < 1 || month > 12)
      throw new Error('invalid_summary_period');
  }
  if (channel === 'local:account-balances') {
    if (!Array.isArray(args[0]) || args[0].length > 1000 || args[0].some((id) => typeof id !== 'string'))
      throw new Error('invalid_account_ids');
  }
  if (channel === 'local:backup') assertPath(args[0], true);
  if (channel === 'local:backup-preview') assertPath(args[0]);
  if (channel === 'local:restore') {
    assertPath(args[0]);
    if (!/^[a-f0-9]{64}$/.test(String(args[1] || ''))) throw new Error('invalid_restore_revision');
  }
}

function registerLocalDataIpc({ ipcMain, database, app, assertTrustedSender }) {
  if (typeof assertTrustedSender !== 'function') throw new TypeError('assertTrustedSender is required');
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
    'local:backup': (_e, destination) =>
      database.backup(destination || path.join(app.getPath('documents'), `finanzas-backup-${Date.now()}.sqlite3`)),
    'local:backup-preview': (_e, source) => database.backupPreview(source),
    'local:restore': (_e, source, expectedCurrentRevision) => database.restore(source, expectedCurrentRevision),
  };
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event);
      validateArguments(channel, args);
      return handlers[channel](event, ...args);
    });
  }
  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerLocalDataIpc, CHANNELS, validateArguments, MAX_BATCH_ITEMS, MAX_PAYLOAD_BYTES };
