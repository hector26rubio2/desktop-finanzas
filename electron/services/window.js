const path = require('path');
const { startLocalServer } = require('./local-server');

function configureHeaders(session, { isDev, nonce }) {

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "frame-src 'none'",
    `connect-src 'self'${isDev ? ' ws://localhost:4200' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
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

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, code, description) => logger.error('did-fail-load', code, description));
  if (isDev) await window.loadURL('http://localhost:4200');
  else { const local = await startLocalServer(path.join(__dirname, '..', '..', 'dist', 'browser')); await window.loadURL(local.origin); }
  return window;
}

module.exports = { createWindow };
