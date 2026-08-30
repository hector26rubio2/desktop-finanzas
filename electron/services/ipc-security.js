function createIpcSecurity({ BrowserWindow, isDev }) {
  const trustedOrigins = new WeakMap();

  function trustWindow(window, origin) {
    if (!window || window.isDestroyed?.()) throw new Error('Cannot trust a destroyed window');
    trustedOrigins.set(window.webContents, String(origin));
  }

  function assertTrustedSender(event) {
    const sender = event?.sender;
    const frame = event?.senderFrame;
    const window = sender ? BrowserWindow.fromWebContents(sender) : null;
    const expectedOrigin = sender ? trustedOrigins.get(sender) : null;

    if (!sender || !frame || !window || window.isDestroyed?.() || frame !== sender.mainFrame || !expectedOrigin) {
      throw new Error('untrusted_ipc_sender');
    }

    let actual;
    let expected;
    try {
      actual = new URL(frame.url);
      expected = new URL(expectedOrigin);
    } catch {
      throw new Error('untrusted_ipc_sender');
    }

    if (
      actual.origin !== expected.origin ||
      actual.username ||
      actual.password ||
      actual.protocol !== 'http:' ||
      !['localhost', '127.0.0.1'].includes(actual.hostname) ||
      (isDev && actual.origin !== 'http://localhost:4200')
    ) {
      throw new Error('untrusted_ipc_sender');
    }
  }

  return { trustWindow, assertTrustedSender };
}

module.exports = { createIpcSecurity };
