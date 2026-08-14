const { contextBridge, ipcRenderer } = require('electron');

// Ninguna clave de cifrado se expone al renderer. Tampoco queda cifrado de
// tráfico: la aplicación no tiene servidor al que hablar.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  log: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
  // Cifrado a nivel de SO para el token de reanudación de sesión. Devuelven
  // null si no está disponible → el renderer usa su cifrado web de respaldo.
  secureEncrypt: (plain) => ipcRenderer.invoke('secure:encrypt', plain),
  secureDecrypt: (b64) => ipcRenderer.invoke('secure:decrypt', b64),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  // Autenticación local: no hay servidor. El perfil y la sesión viven en el main.
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
    list: (kind, ownerId) => ipcRenderer.invoke('local:list', kind, ownerId),
    get: (kind, ownerId, id) => ipcRenderer.invoke('local:get', kind, ownerId, id),
    put: (kind, ownerId, value, operation) => ipcRenderer.invoke('local:put', kind, ownerId, value, operation),
    putMany: (kind, ownerId, values, operation) => ipcRenderer.invoke('local:put-many', kind, ownerId, values, operation),
    batch: (ownerId, operations) => ipcRenderer.invoke('local:batch', ownerId, operations),
    remove: (kind, ownerId, id) => ipcRenderer.invoke('local:remove', kind, ownerId, id),
    movements: (ownerId, query) => ipcRenderer.invoke('local:movements', ownerId, query),
    summary: (ownerId, year, month) => ipcRenderer.invoke('local:summary', ownerId, year, month),
    accountBalances: (ownerId, ids) => ipcRenderer.invoke('local:account-balances', ownerId, ids),
    backup: (destination) => ipcRenderer.invoke('local:backup', destination),
    backupPreview: (source) => ipcRenderer.invoke('local:backup-preview', source),
    restore: (source, expectedCurrentRevision) => ipcRenderer.invoke('local:restore', source, expectedCurrentRevision),
  }),
});
