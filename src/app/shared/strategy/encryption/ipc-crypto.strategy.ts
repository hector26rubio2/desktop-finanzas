import { EncryptionStrategy } from './strategy';

// Estrategia de cifrado para Electron: delega en el proceso main vía IPC.
// La clave de cifrado nunca llega al renderer.

interface ElectronCryptoApi {
  cryptoEncrypt?: (plain: string) => Promise<string | null>;
  cryptoDecrypt?: (b64: string) => Promise<string | null>;
}

function api(): ElectronCryptoApi | null {
  const a = (window as unknown as Record<string, unknown>)['electronAPI'];
  return a && typeof a === 'object' ? (a as ElectronCryptoApi) : null;
}

// Evita prototype pollution al parsear JSON descifrado (igual que aes-gcm.strategy).
function sanitizeParsed(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizeParsed);
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
    safe[k] = sanitizeParsed(v);
  }
  return safe;
}

export const ipcCryptoStrategy: EncryptionStrategy = {
  async encrypt(data: unknown): Promise<string> {
    const a = api();
    if (!a?.cryptoEncrypt) throw new Error('Electron crypto unavailable');
    const out = await a.cryptoEncrypt(JSON.stringify(data));
    if (out == null) throw new Error('Electron encrypt returned null (clave no configurada)');
    return out;
  },

  async decrypt<T>(payload: string): Promise<T> {
    const a = api();
    if (!a?.cryptoDecrypt) throw new Error('Electron crypto unavailable');
    const out = await a.cryptoDecrypt(payload);
    if (out == null) throw new Error('Electron decrypt returned null');
    return sanitizeParsed(JSON.parse(out)) as T;
  },
};
