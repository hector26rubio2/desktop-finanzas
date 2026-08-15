import { Injectable } from '@angular/core';

const STORAGE_KEY = '_rt';

async function deriveStorageKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode('finanzas-local-storage-v2');
  const keyMaterial = await crypto.subtle.importKey('raw', raw, { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('finanzas-rt-salt-v2'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function localEncrypt(plaintext: string): Promise<string> {
  const key = await deriveStorageKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function localDecrypt(ciphertext: string): Promise<string> {
  const key = await deriveStorageKey();
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

interface ElectronSecureApi {
  secureEncrypt?: (plain: string) => Promise<string | null>;
  secureDecrypt?: (b64: string) => Promise<string | null>;
}

function electronApi(): ElectronSecureApi | null {
  const api = (window as unknown as Record<string, unknown>)['electronAPI'];
  return api && typeof api === 'object' ? (api as ElectronSecureApi) : null;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private _hasStoredToken = false;

  constructor() {
    this._hasStoredToken = localStorage.getItem(STORAGE_KEY) !== null || sessionStorage.getItem(STORAGE_KEY) !== null;
  }

  get hasStoredToken(): boolean {
    return this._hasStoredToken;
  }

  async getResumeToken(): Promise<string | null> {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { v: number; d: string };

      if (parsed.v === 4 && typeof parsed.d === 'string') {
        const api = electronApi();
        const dec = api?.secureDecrypt ? await api.secureDecrypt(parsed.d) : null;
        if (dec !== null) return dec;
        this.clear();
        return null;
      }
      if (parsed.v === 3 && typeof parsed.d === 'string') {
        return await localDecrypt(parsed.d);
      }
      this.clear();
      return null;
    } catch {
      this.clear();
      return null;
    }
  }

  async saveResumeToken(token: string, remember: boolean): Promise<void> {
    const storage = remember ? localStorage : sessionStorage;

    const api = electronApi();
    if (api?.secureEncrypt) {
      const enc = await api.secureEncrypt(token);
      if (enc) {
        storage.setItem(STORAGE_KEY, JSON.stringify({ v: 4, d: enc }));
        this._hasStoredToken = true;
        return;
      }
    }

    const encrypted = await localEncrypt(token);
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, d: encrypted }));
    this._hasStoredToken = true;
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    this._hasStoredToken = false;
  }
}
