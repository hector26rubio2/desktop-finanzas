const crypto = require('crypto');
const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session } = require('electron');
const { LocalDatabase } = require('./local-data/database');
const { LocalAuthStore } = require('./local-data/auth-store');
const { registerAuthIpc } = require('./local-data/auth-ipc');
const { registerLocalDataIpc } = require('./local-data/ipc');
const { createLogger } = require('./services/logger');
const { registerSecurityIpc } = require('./services/security');
const { setupUpdater } = require('./services/updater');
const { createWindow } = require('./services/window');
const { createIpcSecurity } = require('./services/ipc-security');
const { registerDialogsIpc } = require('./services/dialogs');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const logger = createLogger(app);
const ipcSecurity = createIpcSecurity({ BrowserWindow, isDev });
let database;
if (!app.requestSingleInstanceLock()) app.quit();
if (isDev) app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
process.on('uncaughtException', (error) => logger.error('uncaughtException', error.stack || error.message));
process.on('unhandledRejection', (error) => logger.error('unhandledRejection', error?.stack || String(error)));

ipcMain.on('log:write', (event, payload = {}) => {
  try {
    ipcSecurity.assertTrustedSender(event);
    logger.renderer(payload.level || 'log', String(payload.message || '').slice(0, 4096), payload.data);
  } catch (error) {
    logger.warn('renderer log rejected', error.message);
  }
});
registerSecurityIpc({ ipcMain, safeStorage, logger, assertTrustedSender: ipcSecurity.assertTrustedSender });
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  database = new LocalDatabase({ app, logger, safeStorage });
  database.open();
  registerLocalDataIpc({
    ipcMain,
    database,
    app,
    assertTrustedSender: ipcSecurity.assertTrustedSender,
  });
  registerAuthIpc({
    ipcMain,
    store: new LocalAuthStore({ app, safeStorage, logger }),
    database,
    assertTrustedSender: ipcSecurity.assertTrustedSender,
  });
  registerDialogsIpc({
    ipcMain,
    dialog,
    BrowserWindow,
    app,
    assertTrustedSender: ipcSecurity.assertTrustedSender,
  });
  setupUpdater({
    ipcMain,
    BrowserWindow,
    isDev: isDev || !app.isPackaged,
    logger,
    assertTrustedSender: ipcSecurity.assertTrustedSender,
  });
  await createWindow({
    BrowserWindow,
    session,
    isDev,
    nonce: crypto.randomBytes(16).toString('base64'),
    logger,
    trustWindow: ipcSecurity.trustWindow,
  });
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow({
      BrowserWindow,
      session,
      isDev,
      nonce: crypto.randomBytes(16).toString('base64'),
      logger,
      trustWindow: ipcSecurity.trustWindow,
    });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  database?.close();
  logger.close();
});
