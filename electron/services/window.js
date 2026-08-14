const path = require('path');
const { startLocalServer } = require('./local-server');

function configureHeaders(session, { isDev, nonce }) {
  const csp = [`default-src 'self'`, `script-src 'self' 'nonce-${nonce}' https://accounts.google.com https://apis.google.com https://ssl.gstatic.com https://*.gstatic.com${isDev ? " 'unsafe-eval'" : ''}`, "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'", "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https://*.google.com https://*.googleusercontent.com https://*.gstatic.com", "frame-src https://accounts.google.com https://*.google.com", `connect-src 'self' https://accounts.google.com https://*.googleapis.com https://github.com https://api-finanzas-gjop.onrender.com${isDev ? ' http://localhost:5063 ws://localhost:4200' : ''}`, "object-src 'none'", "base-uri 'self'"].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['cross-origin-opener-policy']; delete headers['Cross-Origin-Opener-Policy'];
    if (!isDev) headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
}

async function createWindow({ BrowserWindow, session, isDev, nonce, logger }) {
  configureHeaders(session, { isDev, nonce });
  const userAgent = session.defaultSession.getUserAgent().replace(/Electron\/[\d.]+ /, '');
  session.defaultSession.setUserAgent(userAgent);
  const window = new BrowserWindow({ width: 1280, height: 800, show: false, backgroundColor: '#0f172a', webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, nativeWindowOpen: true, devTools: isDev, preload: path.join(__dirname, '..', 'preload.js') } });
  window.webContents.setWindowOpenHandler(({ url }) => url.startsWith('https://accounts.google.com') ? { action: 'allow', overrideBrowserWindowOptions: { width: 500, height: 620, webPreferences: { sandbox: true, contextIsolation: true } } } : { action: 'deny' });
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, code, description) => logger.error('did-fail-load', code, description));
  if (isDev) await window.loadURL('http://localhost:4200');
  else { const local = await startLocalServer(path.join(__dirname, '..', '..', 'dist', 'browser')); await window.loadURL(local.origin); }
  return window;
}

module.exports = { createWindow };
