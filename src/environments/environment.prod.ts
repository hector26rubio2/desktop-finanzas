export const environment = {
  production: true,
  dataMode: 'local-only' as const,
  encryptionKey: '', // loaded at runtime from Electron via preload.js
};
