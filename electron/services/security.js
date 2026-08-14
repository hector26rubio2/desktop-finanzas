const crypto = require('crypto');

function registerSecurityIpc({ ipcMain, safeStorage, logger }) {
  let trafficKey;
  const deriveTrafficKey = () => {
    if (trafficKey) return trafficKey;
    const secret = process.env.FINANZAS_ENCRYPTION_KEY;
    if (!secret) return null;
    trafficKey = crypto.pbkdf2Sync(secret, 'finanzas-salt-v2', 600000, 32, 'sha256');
    return trafficKey;
  };
  ipcMain.handle('secure:encrypt', (_event, value) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(value)).toString('base64') : null);
  ipcMain.handle('secure:decrypt', (_event, value) => {
    try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(String(value), 'base64')) : null; }
    catch (error) { logger.error('secure:decrypt failed', error.message); return null; }
  });
  ipcMain.handle('crypto:encrypt', (_event, value) => {
    const key = deriveTrafficKey();
    if (!key) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  });
  ipcMain.handle('crypto:decrypt', (_event, value) => {
    const key = deriveTrafficKey();
    if (!key) return null;
    try {
      const raw = Buffer.from(String(value), 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    } catch (error) { logger.error('crypto:decrypt failed', error.message); return null; }
  });
}

module.exports = { registerSecurityIpc };
