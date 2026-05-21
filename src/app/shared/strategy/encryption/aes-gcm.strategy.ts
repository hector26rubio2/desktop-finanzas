import { EncryptionStrategy } from './strategy';
import { environment } from '../../../../environments/environment';

let cachedKey: CryptoKey | null = null;

async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const passphrase = new TextEncoder().encode(environment.encryptionKey);
  const salt = new TextEncoder().encode('finanzas-salt-v1');
  const keyMaterial = await crypto.subtle.importKey('raw', passphrase, 'PBKDF2', false, ['deriveKey']);
  cachedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return cachedKey;
}

function sanitizeParsed(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizeParsed);
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    safe[k] = sanitizeParsed(v);
  }
  return safe;
}

const IV_LEN = 12;
const TAG_LEN = 16;

async function toBase64(bytes: Uint8Array): Promise<string> {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export const aesGcmStrategy: EncryptionStrategy = {
  async encrypt(data: unknown): Promise<string> {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const encryptedBytes = new Uint8Array(encrypted);
    const ct = encryptedBytes.slice(0, encryptedBytes.length - TAG_LEN);
    const tag = encryptedBytes.slice(encryptedBytes.length - TAG_LEN);
    const combined = new Uint8Array(IV_LEN + TAG_LEN + ct.length);
    combined.set(iv, 0);
    combined.set(tag, IV_LEN);
    combined.set(ct, IV_LEN + TAG_LEN);
    return toBase64(combined);
  },

  async decrypt<T>(payload: string): Promise<T> {
    const key = await deriveKey();
    const raw = fromBase64(payload);
    const iv = raw.slice(0, IV_LEN);
    const tag = raw.slice(IV_LEN, IV_LEN + TAG_LEN);
    const ct = raw.slice(IV_LEN + TAG_LEN);
    const combined = new Uint8Array(ct.length + TAG_LEN);
    combined.set(ct, 0);
    combined.set(tag, ct.length);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
    return sanitizeParsed(JSON.parse(new TextDecoder().decode(decrypted))) as T;
  },
};
