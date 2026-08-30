const CHANNELS = new Set(['secure:encrypt', 'secure:decrypt']);
const MAX_SECRET_LENGTH = 16_384;

function registerSecurityIpc({ ipcMain, safeStorage, logger, assertTrustedSender }) {
  if (typeof assertTrustedSender !== 'function') throw new TypeError('assertTrustedSender is required');
  ipcMain.handle('secure:encrypt', (event, value) => {
    assertTrustedSender(event);
    const plain = String(value ?? '');
    if (plain.length > MAX_SECRET_LENGTH) throw new RangeError('secure_value_too_large');
    return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plain).toString('base64') : null;
  });
  ipcMain.handle('secure:decrypt', (event, value) => {
    assertTrustedSender(event);
    const encrypted = String(value ?? '');
    if (encrypted.length > MAX_SECRET_LENGTH * 2) throw new RangeError('secure_value_too_large');
    try {
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(encrypted, 'base64')) : null;
    } catch (error) {
      logger.error('secure:decrypt failed', error.message);
      return null;
    }
  });
  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerSecurityIpc, CHANNELS, MAX_SECRET_LENGTH };
