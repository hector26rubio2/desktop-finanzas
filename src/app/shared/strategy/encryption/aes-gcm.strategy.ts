import { EncryptionStrategy } from './strategy';
import { getEncryptionKey } from '../../utils/encryption-key';
import type { CryptoWorkerMessage, CryptoWorkerResponse } from './crypto.worker';

let cachedKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

function deriveKeyFromWorker(): Promise<CryptoKey> {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (keyPromise) return keyPromise;

  keyPromise = new Promise<CryptoKey>((resolve, reject) => {
    const w = getWorker();
    const passphrase = new TextEncoder().encode(getEncryptionKey());
    const salt = new TextEncoder().encode('finanzas-salt-v2');

    const handler = (e: MessageEvent<CryptoWorkerResponse>) => {
      if (e.data.type === 'keyDerived') {
        w.removeEventListener('message', handler);
        crypto.subtle
          .importKey('jwk', e.data.key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
          .then((key) => {
            cachedKey = key;
            resolve(key);
          })
          .catch(reject);
      }
    };

    w.addEventListener('message', handler);
    const pBuf: ArrayBuffer = passphrase.buffer.slice(
      passphrase.byteOffset,
      passphrase.byteOffset + passphrase.byteLength,
    );
    const sBuf: ArrayBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);
    w.postMessage({ type: 'deriveKey', passphrase: pBuf, salt: sBuf } satisfies CryptoWorkerMessage, [pBuf, sBuf]);
  });

  return keyPromise;
}

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
    const key = await deriveKeyFromWorker();
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
    const key = await deriveKeyFromWorker();
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
