const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Load .env file if present (works in both dev and local-prod modes)
const envPath = path.join(__dirname, '..', '.env');
console.log('[main:env] envPath=', envPath, 'exists=', fs.existsSync(envPath));
console.log('[main:env] BEFORE: FINANZAS_ENCRYPTION_KEY len=', (process.env.FINANZAS_ENCRYPTION_KEY || '').length);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
console.log('[main:env] AFTER: FINANZAS_ENCRYPTION_KEY len=', (process.env.FINANZAS_ENCRYPTION_KEY || '').length, 'prefix=', (process.env.FINANZAS_ENCRYPTION_KEY || '').slice(0, 8));

const log = (msg, ...args) => console.log(`[main:finanzas] ${msg}`, ...args);
const err = (msg, ...args) => console.error(`[main:finanzas] ${msg}`, ...args);

const nonce = crypto.randomBytes(16).toString('base64');
process.env.CSP_NONCE = nonce;

if (!process.env.FINANZAS_ENCRYPTION_KEY) {
  process.env.FINANZAS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

function buildCSP(nonceValue) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonceValue}' https://accounts.google.com https://apis.google.com https://ssl.gstatic.com https://*.gstatic.com${
      isDev ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' https://fonts.googleapis.com https://accounts.google.com https://ssl.gstatic.com https://*.gstatic.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.google.com https://*.googleusercontent.com https://*.gstatic.com",
    'frame-src https://accounts.google.com https://*.google.com',
    `connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.gstatic.com https://github.com${
      isDev ? ' http://localhost:5063 ws://localhost:4200 ws://localhost:5063' : ''
    }`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

const CSP = buildCSP(nonce);

log(`starting (dev=${isDev})`);

if (isDev) {
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
  log('COOP disabled via command line');
}

let updaterChannel = { value: null };

function setupAutoUpdater() {
  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      log('auto-updater: checking for update');
      updaterChannel.value = 'checking';
      sendToAllWindows('update-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      log('auto-updater: update available', info.version);
      updaterChannel.value = 'available';
      sendToAllWindows('update-status', {
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', () => {
      log('auto-updater: up to date');
      updaterChannel.value = 'not-available';
      sendToAllWindows('update-status', { status: 'not-available' });
    });

    autoUpdater.on('error', (error) => {
      err('auto-updater: error', error.message);
      updaterChannel.value = 'error';
      sendToAllWindows('update-status', {
        status: 'error',
        message: error.message,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      log(`auto-updater: download ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`);
      sendToAllWindows('update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log('auto-updater: update downloaded', info.version);
      updaterChannel.value = 'downloaded';
      sendToAllWindows('update-status', {
        status: 'downloaded',
        version: info.version,
      });
    });

    ipcMain.handle('update:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return { available: result.updateInfo != null };
      } catch (e) {
        return { available: false, error: e.message };
      }
    });

    ipcMain.handle('update:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle('update:install', () => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });

    log('auto-updater: initialized');

    if (!isDev) {
      setTimeout(() => {
        log('auto-updater: checking for updates on startup');
        autoUpdater.checkForUpdates().catch((e) => {
          err('auto-updater: startup check failed', e.message);
        });
      }, 5000);
    }
  } catch (e) {
    err('auto-updater: initialization failed', e.message);
  }
}

function sendToAllWindows(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data);
  }
}

function createWindow() {
  log('creating window');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: isDev,
    backgroundColor: '#0f172a',
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      nativeWindowOpen: true,
      devTools: isDev,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['cross-origin-opener-policy'];
    delete headers['Cross-Origin-Opener-Policy'];
    if (!isDev) {
      headers['Content-Security-Policy'] = [CSP];
    }
    callback({ responseHeaders: headers });
  });

  if (isDev) {
    log('loading http://localhost:4200');
    win.loadURL('http://localhost:4200');
  } else {
    const filePath = path.join(__dirname, '..', 'dist', 'browser', 'index.html');
    log('loading file:', filePath);
    win.loadFile(filePath);
  }

  win.webContents.on('did-fail-load', (_event, code, desc) => {
    err(`did-fail-load code=${code} desc=${desc}`);
    if (isDev) {
      win.webContents.openDevTools({ mode: 'bottom' });
    }
  });

  win.webContents.on('console-message', (_event, level, message) => {
    const prefix = level === 2 ? '[render:warn]' : level === 3 ? '[render:error]' : '[render:log]';
    console.log(`${prefix} ${message}`);
  });
}

app.whenReady().then(() => {
  log('app ready');
  setupAutoUpdater();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
