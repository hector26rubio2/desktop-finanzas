const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  log: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
  secureEncrypt: (plain) => ipcRenderer.invoke('secure:encrypt', plain),
  secureDecrypt: (b64) => ipcRenderer.invoke('secure:decrypt', b64),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  dialogs: Object.freeze({
    chooseBackupDestination: () => ipcRenderer.invoke('dialog:backup-destination'),
    chooseBackupSource: () => ipcRenderer.invoke('dialog:backup-source'),
  }),
  auth: Object.freeze({
    status: () => ipcRenderer.invoke('auth:status'),
    register: (payload) => ipcRenderer.invoke('auth:register', payload),
    login: (payload) => ipcRenderer.invoke('auth:login', payload),
    resume: (resumeToken) => ipcRenderer.invoke('auth:resume', resumeToken),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (payload) => ipcRenderer.invoke('auth:change-password', payload),
    recover: (payload) => ipcRenderer.invoke('auth:recover', payload),
    updateProfile: (patch) => ipcRenderer.invoke('auth:update-profile', patch),
  }),
  localData: Object.freeze({
    status: () => ipcRenderer.invoke('local:status'),
    list: (entity) => ipcRenderer.invoke('local:list', entity),
    get: (entity, id) => ipcRenderer.invoke('local:get', entity, id),
    put: (entity, value) => ipcRenderer.invoke('local:put', entity, value),
    putMany: (entity, values) => ipcRenderer.invoke('local:put-many', entity, values),
    batch: (operations) => ipcRenderer.invoke('local:batch', operations),
    remove: (entity, id) => ipcRenderer.invoke('local:remove', entity, id),
    movements: (query) => ipcRenderer.invoke('local:movements', query),
    summary: (year, month) => ipcRenderer.invoke('local:summary', year, month),
    accountBalances: (ids) => ipcRenderer.invoke('local:account-balances', ids),
    backup: (destination) => ipcRenderer.invoke('local:backup', destination),
    backupPreview: (source) => ipcRenderer.invoke('local:backup-preview', source),
    restore: (source, expectedCurrentRevision) => ipcRenderer.invoke('local:restore', source, expectedCurrentRevision),
  }),
});
