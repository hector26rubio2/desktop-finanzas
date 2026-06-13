import { environment } from '../../../environments/environment';

const EK_VERSION = 3;
const STORAGE_KEY = '_ek';

function getElectronKey(): string {
  try {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const api = w['electronAPI'];
    if (api && typeof api['encryptionKey'] === 'string') {
      return api['encryptionKey'] as string;
    }
  } catch {
    // not running in Electron
  }
  return '';
}

function readStoredKey(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'v' in parsed && 'k' in parsed) {
      const obj = parsed as { v: unknown; k: unknown };
      if (obj.v === EK_VERSION && typeof obj.k === 'string') return obj.k;
    }
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: EK_VERSION, k: key }));
  } catch {
    // storage unavailable
  }
}

function generateKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getEncryptionKey(): string {
  const electronKey = getElectronKey();
  if (electronKey) return electronKey;

  const envKey = environment.encryptionKey;
  if (envKey) return envKey;

  // A locally-generated key can never match the backend's key, so encrypted
  // traffic would fail silently. In production that is a hard error.
  if (environment.production) {
    throw new Error('Encryption key unavailable: expected key from Electron preload.');
  }

  const stored = readStoredKey();
  if (stored) return stored;

  const generated = generateKey();
  storeKey(generated);
  return generated;
}
