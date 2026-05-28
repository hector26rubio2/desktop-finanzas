const crypto = require('crypto');

const KEY_ITERATIONS = 600_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = 'finanzas-salt-v2';
const ALGORITHM = 'aes-256-gcm';

function getPassphrase() {
  return process.env.FINANZAS_ENCRYPTION_KEY || 'change-me-in-production-use-a-strong-random-key';
}

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const passphrase = getPassphrase();
  cachedKey = crypto.pbkdf2Sync(passphrase, SALT, KEY_ITERATIONS, KEY_LENGTH, 'sha256');
  return cachedKey;
}

class AesGcmStrategy {
  encrypt(data) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(payload) {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const data = buf.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }
}

function createCrypto() {
  const strategy = new AesGcmStrategy();
  return {
    encrypt: (data) => strategy.encrypt(data),
    decrypt: (payload) => strategy.decrypt(payload),
  };
}

module.exports = { AesGcmStrategy, createCrypto, getPassphrase, SALT };