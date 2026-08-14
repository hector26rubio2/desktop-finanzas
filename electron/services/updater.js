function setupUpdater({ ipcMain, BrowserWindow, isDev, logger }) {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    const send = (status, extra = {}) => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('update-status', { status, ...extra }));
    autoUpdater.on('checking-for-update', () => send('checking'));
    autoUpdater.on('update-available', (info) => send('available', { version: info.version, releaseNotes: info.releaseNotes }));
    autoUpdater.on('update-not-available', () => send('not-available'));
    autoUpdater.on('download-progress', (progress) => send('downloading', { percent: Math.round(progress.percent) }));
    autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));
    // Una compilación sin instalador no lleva `app-update.yml`, y sin conexión
    // no hay a quién preguntar. Ninguna de las dos es un fallo que el usuario
    // pueda resolver, así que se registran pero no se le enseñan: un banner rojo
    // permanente por algo inaccionable acaba enseñando a ignorar los banners.
    const isUnactionable = (message) => /app-update\.yml|ENOENT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|net::/i.test(message || '');
    autoUpdater.on('error', (error) => {
      logger.error('updater', error.message);
      if (!isUnactionable(error.message)) send('error', { message: error.message });
    });
    ipcMain.handle('update:check', async () => { try { const result = await autoUpdater.checkForUpdates(); return { available: Boolean(result?.updateInfo) }; } catch (error) { return { available: false, error: error.message }; } });
    ipcMain.handle('update:download', async () => { try { await autoUpdater.downloadUpdate(); return { success: true }; } catch (error) { return { success: false, error: error.message }; } });
    ipcMain.handle('update:install', () => setImmediate(() => autoUpdater.quitAndInstall()));
    if (!isDev) setTimeout(() => autoUpdater.checkForUpdates().catch((error) => logger.error('startup update check', error.message)), 5000);
  } catch (error) { logger.error('updater initialization', error.message); }
}

module.exports = { setupUpdater };
