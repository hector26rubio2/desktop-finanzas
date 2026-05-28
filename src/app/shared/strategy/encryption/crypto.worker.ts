/// <reference lib="webworker" />

const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent<CryptoWorkerMessage>) => {
  const msg = e.data;
  if (msg.type === 'deriveKey') {
    const keyMaterial = await crypto.subtle.importKey('raw', msg.passphrase, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: msg.salt, iterations: 600_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const jwk = await crypto.subtle.exportKey('jwk', key);
    ctx.postMessage({ type: 'keyDerived', key: jwk } satisfies CryptoWorkerResponse);
  } else if (msg.type === 'encrypt') {
    const key = await crypto.subtle.importKey('jwk', msg.key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: msg.iv }, key, msg.data);
    ctx.postMessage({ type: 'encrypted', data: encrypted } satisfies CryptoWorkerResponse);
  } else if (msg.type === 'decrypt') {
    const key = await crypto.subtle.importKey('jwk', msg.key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: msg.iv }, key, msg.data);
    ctx.postMessage({ type: 'decrypted', data: decrypted } satisfies CryptoWorkerResponse);
  }
};

export type CryptoWorkerMessage =
  | { type: 'deriveKey'; passphrase: ArrayBuffer; salt: ArrayBuffer }
  | { type: 'encrypt'; key: JsonWebKey; data: ArrayBuffer; iv: ArrayBuffer }
  | { type: 'decrypt'; key: JsonWebKey; data: ArrayBuffer; iv: ArrayBuffer };

export type CryptoWorkerResponse =
  | { type: 'keyDerived'; key: JsonWebKey }
  | { type: 'encrypted'; data: ArrayBuffer }
  | { type: 'decrypted'; data: ArrayBuffer };
