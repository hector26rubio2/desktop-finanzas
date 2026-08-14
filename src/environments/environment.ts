export const environment = {
  production: false,
  dataMode: 'local-only' as const,
  encryptionKey: '', // loaded at runtime from Electron preload (FINANZAS_ENCRYPTION_KEY in desktop/.env)
};
