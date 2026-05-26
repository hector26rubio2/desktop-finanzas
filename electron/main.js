const { app, BrowserWindow, session } = require("electron");
const path = require("path");

const isDev = process.argv.includes("--dev") || process.env.NODE_ENV === 'development';

const log = (msg, ...args) => console.log(`[main:finanzas] ${msg}`, ...args);
const err = (msg, ...args) => console.error(`[main:finanzas] ${msg}`, ...args);

const CSP = [
  "default-src 'self'",
  `script-src 'self' https://accounts.google.com https://apis.google.com https://ssl.gstatic.com https://*.gstatic.com 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' https://fonts.googleapis.com https://accounts.google.com https://ssl.gstatic.com https://*.gstatic.com 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.google.com https://*.googleusercontent.com https://*.gstatic.com",
  "frame-src https://accounts.google.com https://*.google.com",
  `connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.gstatic.com${isDev ? ' http://localhost:5063 ws://localhost:4200 ws://localhost:5063' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

log(`starting (dev=${isDev})`);

if (isDev) {
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
  log('COOP disabled via command line');
}

function createWindow() {
  log("creating window");

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

  // Allow OAuth popup windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    // Strip COOP to allow Google OAuth postMessage
    delete headers['cross-origin-opener-policy'];
    delete headers['Cross-Origin-Opener-Policy'];
    // Only apply CSP in production
    if (!isDev) {
      headers['Content-Security-Policy'] = [CSP];
    }
    callback({ responseHeaders: headers });
  });

  if (isDev) {
    log('loading http://localhost:4200');
    win.loadURL("http://localhost:4200");
  } else {
    const filePath = path.join(__dirname, "..", "dist", "browser", "index.html");
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
  log("app ready");
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
