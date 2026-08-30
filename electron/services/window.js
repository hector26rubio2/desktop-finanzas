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
    delete headers['cross-origin-opener-policy'];
    delete headers['Cross-Origin-Opener-Policy'];
    if (!isDev) {
      headers['Content-Security-Policy'] = [csp];
      headers['Cross-Origin-Opener-Policy'] = ['same-origin'];
    }
    headers['X-Content-Type-Options'] = ['nosniff'];
    headers['Referrer-Policy'] = ['no-referrer'];
    headers['Permissions-Policy'] = ['camera=(), microphone=(), geolocation=(), payment=(), usb=()'];
    callback({ responseHeaders: headers });
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

async function createWindow({ BrowserWindow, session, isDev, nonce, logger, trustWindow }) {
  configureHeaders(session, { isDev, nonce });
  const userAgent = session.defaultSession.getUserAgent().replace(/Electron\/[\d.]+ /, '');
  session.defaultSession.setUserAgent(userAgent);
  const window = new BrowserWindow({
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
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, '..', 'preload.js'),
    },
  });

  let allowedOrigin = 'http://localhost:4200';
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      if (new URL(targetUrl).origin !== allowedOrigin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, code, description) =>
    logger.error('did-fail-load', code, description),
  );
  if (isDev) {
    trustWindow(window, allowedOrigin);
    await window.loadURL(allowedOrigin);
  } else {
    const local = await startLocalServer(path.join(__dirname, '..', '..', 'dist', 'browser'));
    allowedOrigin = local.origin;
    trustWindow(window, allowedOrigin);
    window.once('closed', () => local.server.close());
    await window.loadURL(local.origin);
  }
  return window;
}

module.exports = { createWindow };
