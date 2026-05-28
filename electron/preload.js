const { contextBridge, ipcRenderer } = require('electron');

const encryptionKey = process.env.FINANZAS_ENCRYPTION_KEY || '';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  encryptionKey,
  log: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
});