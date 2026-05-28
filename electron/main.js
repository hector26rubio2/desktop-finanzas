const { app, BrowserWindow, session, ipcMain, Menu } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function createHttpServer(distPath) {
  return http.createServer((req, res) => {
    let urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(distPath, urlPath);
    if (!fs.existsSync(filePath)) filePath = path.join(distPath, 'index.html');

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    } catch (_) {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

// Try port 80 first (→ http://localhost, no port in URL, Google OAuth friendly).
// Fall back to fixed port 4269 if 80 is taken (e.g. IIS running).
const FALLBACK_PORT = 4269;

function startLocalServer(distPath) {
  return new Promise((resolve) => {
    const server = createHttpServer(distPath);

    server.listen(80, '127.0.0.1', () => {
      resolve({ port: 80, origin: 'http://localhost' });
    });

    server.on('error', () => {
      const s2 = createHttpServer(distPath);
      s2.listen(FALLBACK_PORT, '127.0.0.1', () => {
        resolve({ port: FALLBACK_PORT, origin: `http://localhost:${FALLBACK_PORT}` });
      });
      s2.on('error', () => {
        // last resort: OS-assigned port
        const s3 = createHttpServer(distPath);
        s3.listen(0, '127.0.0.1', () => {
          const { port } = s3.address();
          resolve({ port, origin: `http://localhost:${port}` });
        });
      });
    });
  });
}

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Load .env file based on environment
if (isDev) {
  const envPath = path.join(__dirname, '..', '.env');
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
} else {
  // In production, .env.production is in resources
  const prodEnvPaths = [
    path.join(process.resourcesPath, '.env.production'),
    path.join(__dirname, '..', '.env.production'),
  ];
  for (const envPath of prodEnvPaths) {
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
      break;
    }
  }
}

// File logger — writes to %APPDATA%\Finanzas\logs\main.log
let _logStream = null;
function getLogStream() {
  if (_logStream) return _logStream;
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'main.log');
    _logStream = fs.createWriteStream(logFile, { flags: 'a' });
    _logStream.write(`\n--- session start ${new Date().toISOString()} ---\n`);
  } catch (e) {
    console.error('[logger] failed to open log file:', e.message);
  }
  return _logStream;
}

function writeLine(prefix, msg, args) {
  const line = `${new Date().toISOString()} ${prefix} ${msg}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`;
  process.stdout.write(line);
  try { getLogStream()?.write(line); } catch (_) {}
}

const log = (msg, ...args) => writeLine('[main]', msg, args);
const err = (msg, ...args) => writeLine('[ERR]', msg, args);

process.on('uncaughtException', (e) => {
  err('uncaughtException:', e.stack || e.message);
});
process.on('unhandledRejection', (reason) => {
  err('unhandledRejection:', reason?.stack || String(reason));
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log('another instance already running — quitting');
  app.quit();
}

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
    `connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.gstatic.com https://github.com https://api-finanzas-gjop.onrender.com${
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
    show: false,
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

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: 'bottom' });
  });

  if (isDev) {
    log('loading http://localhost:4200');
    win.loadURL('http://localhost:4200');
  } else {
    const distPath = path.join(__dirname, '..', 'dist', 'browser');
    startLocalServer(distPath).then(({ port, origin }) => {
      log('local server on port', port, '→', origin);
      win.loadURL(`http://127.0.0.1:${port}`);
    });
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

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  log('app ready');
  Menu.setApplicationMenu(null);
  setupAutoUpdater();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
