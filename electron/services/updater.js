const CHANNELS = new Set(['update:check', 'update:download', 'update:install']);

function setupUpdater({ ipcMain, BrowserWindow, isDev, logger, assertTrustedSender }) {
  if (typeof assertTrustedSender !== 'function') throw new TypeError('assertTrustedSender is required');
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    if ('disableWebInstaller' in autoUpdater) autoUpdater.disableWebInstaller = true;
    if ('allowUnverifiedLinuxPackages' in autoUpdater) autoUpdater.allowUnverifiedLinuxPackages = false;
    const send = (status, extra = {}) =>
      BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('update-status', { status, ...extra }));
    autoUpdater.on('checking-for-update', () => send('checking'));
    autoUpdater.on('update-available', (info) =>
      send('available', { version: info.version, releaseNotes: info.releaseNotes }),
    );
    autoUpdater.on('update-not-available', () => send('not-available'));
    autoUpdater.on('download-progress', (progress) => send('downloading', { percent: Math.round(progress.percent) }));
    autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));

    const isUnactionable = (message) =>
      /app-update\.yml|ENOENT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|net::/i.test(message || '');
    autoUpdater.on('error', (error) => {
      logger.error('updater', error.message);
      if (!isUnactionable(error.message)) send('error', { message: error.message });
    });
    ipcMain.handle('update:check', async (event) => {
      assertTrustedSender(event);
      if (process.platform === 'linux') return { available: false, unsupported: true };
      try {
        const result = await autoUpdater.checkForUpdates();
        return { available: Boolean(result?.updateInfo) };
      } catch (error) {
        return { available: false, error: error.message };
      }
    });
    ipcMain.handle('update:download', async (event) => {
      assertTrustedSender(event);
      if (process.platform === 'linux') return { success: false, error: 'updates_are_managed_by_the_linux_package' };
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    ipcMain.handle('update:install', (event) => {
      assertTrustedSender(event);
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return { scheduled: true };
    });
    if (!isDev && process.platform !== 'linux')
      setTimeout(
        () => autoUpdater.checkForUpdates().catch((error) => logger.error('startup update check', error.message)),
        5000,
      );
  } catch (error) {
    logger.error('updater initialization', error.message);
  }
  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { setupUpdater, CHANNELS };
