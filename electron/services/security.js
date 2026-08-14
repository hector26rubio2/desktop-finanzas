/**
 * Cifrado a nivel de sistema operativo para los secretos del cliente.
 *
 * Aquí vivían además `crypto:encrypt` y `crypto:decrypt`, que cifraban el
 * cuerpo de las peticiones HTTP contra el API con una clave derivada de
 * `FINANZAS_ENCRYPTION_KEY`. Al quedarse la aplicación sin servidor no quedó
 * tráfico que cifrar ni llamador en el renderer, así que se retiraron: un canal
 * IPC que nadie usa es superficie de ataque, y ese era el último uso de una
 * clave que llegó a publicarse.
 */
function registerSecurityIpc({ ipcMain, safeStorage, logger }) {
  ipcMain.handle('secure:encrypt', (_event, value) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(value)).toString('base64') : null);
  ipcMain.handle('secure:decrypt', (_event, value) => {
    try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(String(value), 'base64')) : null; }
    catch (error) { logger.error('secure:decrypt failed', error.message); return null; }
  });
}

module.exports = { registerSecurityIpc };
