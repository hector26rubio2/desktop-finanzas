const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = process.argv.includes("--dev") || process.env.NODE_ENV === 'development';

const log = (msg, ...args) => console.log(`[main:finanzas] ${msg}`, ...args);
const err = (msg, ...args) => console.error(`[main:finanzas] ${msg}`, ...args);

log(`starting (dev=${isDev})`);

function createWindow() {
  log("creating window");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: isDev,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      preload: path.join(__dirname, 'preload.js'),
    },
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
    // log renderer console messages with a prefix
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
