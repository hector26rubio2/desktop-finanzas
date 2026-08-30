const path = require('path');

const CHANNELS = new Set(['dialog:backup-destination', 'dialog:backup-source']);

function registerDialogsIpc({ ipcMain, dialog, BrowserWindow, app, assertTrustedSender }) {
  if (typeof assertTrustedSender !== 'function') throw new TypeError('assertTrustedSender is required');

  ipcMain.handle('dialog:backup-destination', async (event) => {
    assertTrustedSender(event);
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(parent, {
      title: 'Guardar backup cifrado',
      defaultPath: path.join(
        app.getPath('documents'),
        `finanzas-backup-${new Date().toISOString().slice(0, 10)}.sqlite3`,
      ),
      filters: [{ name: 'Backup de Finanzas', extensions: ['sqlite3'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    return result.canceled ? null : result.filePath || null;
  });

  ipcMain.handle('dialog:backup-source', async (event) => {
    assertTrustedSender(event);
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(parent, {
      title: 'Seleccionar backup',
      defaultPath: app.getPath('documents'),
      filters: [{ name: 'Backup de Finanzas', extensions: ['sqlite3'] }],
      properties: ['openFile', 'dontAddToRecent'],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  return () => {
    for (const channel of CHANNELS) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerDialogsIpc, CHANNELS };
