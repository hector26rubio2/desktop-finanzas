function registerSecurityIpc({ ipcMain, safeStorage, logger }) {
  ipcMain.handle('secure:encrypt', (_event, value) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(value)).toString('base64') : null);
  ipcMain.handle('secure:decrypt', (_event, value) => {
    try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(String(value), 'base64')) : null; }
    catch (error) { logger.error('secure:decrypt failed', error.message); return null; }
  });
}

module.exports = { registerSecurityIpc };
