const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, Menu, safeStorage, session } = require('electron');
const { LocalDatabase } = require('./local-data/database');
const { LocalAuthStore } = require('./local-data/auth-store');
const { registerAuthIpc } = require('./local-data/auth-ipc');
const { registerLocalDataIpc } = require('./local-data/ipc');
const { createLogger } = require('./services/logger');
const { registerSecurityIpc } = require('./services/security');
const { setupUpdater } = require('./services/updater');
const { createWindow } = require('./services/window');

// La aplicación no lee ninguna variable de entorno propia. Aquí se cargaba un
// `.env` con la clave del cifrado de tráfico, el client id de Google y la URL
// del API: las tres desaparecieron con el servidor. Cargar un fichero de
// secretos que nadie consulta solo sirve para que alguien vuelva a meter uno.
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const logger = createLogger(app);
let database;
if (!app.requestSingleInstanceLock()) app.quit();
if (isDev) app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
process.on('uncaughtException', (error) => logger.error('uncaughtException', error.stack || error.message));
process.on('unhandledRejection', (error) => logger.error('unhandledRejection', error?.stack || String(error)));

ipcMain.on('log:write', (_event, payload = {}) => logger.renderer(payload.level || 'log', String(payload.message || ''), payload.data));
registerSecurityIpc({ ipcMain, safeStorage, logger });
app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  database = new LocalDatabase({ app, safeStorage, logger, syncEnabled: false });
  database.open();
  registerLocalDataIpc({ ipcMain, database, app });
  registerAuthIpc({ ipcMain, store: new LocalAuthStore({ app, safeStorage, logger }), database });
  setupUpdater({ ipcMain, BrowserWindow, isDev, logger });
  await createWindow({ BrowserWindow, session, isDev, nonce: crypto.randomBytes(16).toString('base64'), logger });
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow({ BrowserWindow, session, isDev, nonce: crypto.randomBytes(16).toString('base64'), logger }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { database?.close(); logger.close(); });
