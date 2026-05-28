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
  if (electronKey) {
    console.debug('[ek] source=electron len=' + electronKey.length + ' prefix=' + electronKey.slice(0, 8));
    return electronKey;
  }

  const envKey = environment.encryptionKey;
  if (envKey) {
    console.debug('[ek] source=env len=' + envKey.length + ' prefix=' + envKey.slice(0, 8));
    return envKey;
  }

  const stored = readStoredKey();
  if (stored) {
    console.debug('[ek] source=localStorage len=' + stored.length + ' prefix=' + stored.slice(0, 8));
    return stored;
  }

  const generated = generateKey();
  console.debug('[ek] source=generated len=' + generated.length + ' prefix=' + generated.slice(0, 8));
  storeKey(generated);
  return generated;
}
