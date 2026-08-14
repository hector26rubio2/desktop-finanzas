const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROFILE_VERSION = 1;
// 128 * N * r = 32 MiB of memory per derivation. maxmem must be raised above the
// 32 MiB Node default or scrypt refuses to run with these parameters.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };
// Crockford base32 without I, L, O and U: no character can be misread when the
// user copies the recovery code by hand.
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_GROUPS = 5;
const RECOVERY_GROUP_LENGTH = 5;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function derive(secret, salt) {
  return crypto.scryptSync(secret.normalize('NFKC'), Buffer.from(salt, 'base64'), SCRYPT.keylen, SCRYPT);
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('base64');
  return { salt, hash: derive(secret, salt).toString('base64'), algorithm: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p };
}

function verifySecret(secret, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const expected = Buffer.from(stored.hash, 'base64');
  const actual = derive(secret, stored.salt);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function newRecoveryCode() {
  const groups = [];
  for (let group = 0; group < RECOVERY_GROUPS; group++) {
    let chunk = '';
    // rejection sampling: 256 % 32 === 0, so a plain modulo stays uniform here.
    for (const byte of crypto.randomBytes(RECOVERY_GROUP_LENGTH)) chunk += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    groups.push(chunk);
  }
  return groups.join('-');
}

function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Local credential store. There is no server: the profile lives on this machine,
 * wrapped by the OS keychain exactly like the database key in `database.js`.
 *
 * The password is an application lock, not disk encryption — the SQLite key is
 * still wrapped by `safeStorage`, so it protects the app against someone using
 * an already-unlocked OS session, not against someone with the raw disk.
 */
class LocalAuthStore {
  constructor({ app, safeStorage, logger, profilePath }) {
    this.safeStorage = safeStorage;
    this.logger = logger;
    this.profilePath = profilePath || path.join(app.getPath('userData'), 'profile.dat');
    this.session = null;
    this.failedAttempts = 0;
    this.lockedUntil = 0;
  }

  status(existingOwners = []) {
    const profile = this.#read();
    return {
      hasProfile: profile !== null,
      // Suggested only; the user edits it before confirming. Never treated as identity.
      suggestedName: profile?.user.name || os.userInfo().username || '',
      unlocked: this.session !== null,
      lockedUntil: this.lockedUntil > Date.now() ? this.lockedUntil : 0,
      // Datos que ya viven en el disco sin perfil que los reclame.
      orphanOwners: profile ? [] : existingOwners,
    };
  }

  /**
   * `existingOwners` son los dueños con documentos vivos en SQLite.
   *
   * Con exactamente uno, el perfil **adopta** ese id: es el caso inequívoco —el
   * usuario tiene una sola historia financiera en esta máquina y acuñar un id
   * nuevo la dejaría invisible sin borrar un solo registro.
   *
   * Con varios no se elige por él: se exige que indique cuál, porque adivinar
   * ahí es decidir de quién son unos movimientos.
   */
  register({ name, email, password, baseCurrency, existingOwners = [], adoptOwnerId = null }) {
    if (this.#read()) throw new Error('A local profile already exists on this machine');
    this.#assertPassword(password);
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw new Error('name is required');

    const owners = existingOwners.map((owner) => String(owner?.ownerId ?? owner)).filter(Boolean);
    let ownerId;
    if (adoptOwnerId) {
      if (owners.length > 0 && !owners.includes(String(adoptOwnerId))) throw new Error('The chosen owner has no data on this machine');
      ownerId = String(adoptOwnerId);
    } else if (owners.length === 1) {
      ownerId = owners[0];
    } else if (owners.length > 1) {
      throw new Error('This machine holds data from more than one owner: choose which one this profile adopts');
    } else {
      ownerId = crypto.randomUUID();
    }

    const recoveryCode = newRecoveryCode();
    const profile = {
      version: PROFILE_VERSION,
      user: {
        id: ownerId,
        name: trimmedName,
        email: String(email || '').trim().toLowerCase(),
        baseCurrency: String(baseCurrency || 'COP').toUpperCase(),
        role: 'owner',
      },
      password: hashSecret(password),
      recovery: hashSecret(normalizeRecoveryCode(recoveryCode)),
      resume: null,
      createdAt: new Date().toISOString(),
    };
    this.#write(profile);
    // Shown once by the UI and never recoverable afterwards — only its hash is stored.
    return { ...this.#open(profile, false), recoveryCode };
  }

  login({ password, remember = false }) {
    this.#assertNotLockedOut();
    const profile = this.#requireProfile();
    if (!verifySecret(String(password || ''), profile.password)) return this.#rejectAttempt();
    this.failedAttempts = 0;
    return this.#open(profile, remember);
  }

  /** Reopens a remembered session at startup without asking for the password. */
  resume(resumeToken) {
    const profile = this.#read();
    if (!profile?.resume || !resumeToken) return null;
    if (!verifySecret(String(resumeToken), profile.resume)) {
      // A token that no longer matches is stale or forged; drop it either way.
      this.#write({ ...profile, resume: null });
      return null;
    }
    return this.#open(profile, true, resumeToken);
  }

  logout() {
    const profile = this.#read();
    if (profile?.resume) this.#write({ ...profile, resume: null });
    this.session = null;
    return { ok: true };
  }

  changePassword({ currentPassword, newPassword }) {
    const profile = this.#requireProfile();
    if (!verifySecret(String(currentPassword || ''), profile.password)) throw new Error('The current password is incorrect');
    this.#assertPassword(newPassword);
    // Every remembered session dies with the old password.
    this.#write({ ...profile, password: hashSecret(newPassword), resume: null });
    return { ok: true };
  }

  /**
   * The only way back in after a forgotten password. The code is single-use: a
   * fresh one is issued and the old hash is gone once this returns.
   */
  recover({ recoveryCode, newPassword }) {
    this.#assertNotLockedOut();
    const profile = this.#requireProfile();
    if (!verifySecret(normalizeRecoveryCode(recoveryCode), profile.recovery)) return this.#rejectAttempt();
    this.#assertPassword(newPassword);
    this.failedAttempts = 0;
    const nextRecoveryCode = newRecoveryCode();
    const updated = {
      ...profile,
      password: hashSecret(newPassword),
      recovery: hashSecret(normalizeRecoveryCode(nextRecoveryCode)),
      resume: null,
    };
    this.#write(updated);
    return { ...this.#open(updated, false), recoveryCode: nextRecoveryCode };
  }

  updateProfile(patch = {}) {
    const profile = this.#requireProfile();
    if (!this.session) throw new Error('There is no open session');
    const user = { ...profile.user };
    if (patch.name !== undefined) user.name = String(patch.name).trim() || user.name;
    if (patch.email !== undefined) user.email = String(patch.email).trim().toLowerCase();
    if (patch.baseCurrency !== undefined) user.baseCurrency = String(patch.baseCurrency).toUpperCase();
    this.#write({ ...profile, user });
    this.session = { ...this.session, user };
    return { user };
  }

  #open(profile, remember, existingResumeToken = null) {
    const resumeToken = remember ? existingResumeToken || crypto.randomBytes(32).toString('base64') : null;
    if (remember && !existingResumeToken) this.#write({ ...profile, resume: hashSecret(resumeToken) });
    this.session = { ownerId: profile.user.id, user: profile.user, openedAt: Date.now() };
    return { ownerId: profile.user.id, user: profile.user, resumeToken };
  }

  #rejectAttempt() {
    this.failedAttempts += 1;
    if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      this.lockedUntil = Date.now() + LOCKOUT_MS;
      this.failedAttempts = 0;
      this.logger?.warn?.('auth', 'too many failed attempts; local sign-in is paused');
    }
    throw new Error('Incorrect credentials');
  }

  #assertNotLockedOut() {
    if (this.lockedUntil > Date.now()) throw new Error(`Too many attempts. Try again in ${Math.ceil((this.lockedUntil - Date.now()) / 1000)}s`);
  }

  #assertPassword(password) {
    const value = String(password || '');
    if (value.length < 8) throw new Error('The password must be at least 8 characters long');
  }

  #requireProfile() {
    const profile = this.#read();
    if (!profile) throw new Error('There is no local profile on this machine yet');
    return profile;
  }

  #read() {
    if (!fs.existsSync(this.profilePath)) return null;
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable; the local profile cannot be unlocked');
    try {
      return JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.profilePath)));
    } catch (error) {
      // A profile that cannot be decrypted is not an empty profile. Failing closed
      // here is what stops a corrupt file from silently offering a fresh signup
      // over data that is still on disk.
      this.logger?.error?.('auth', `the local profile is unreadable: ${error.message}`);
      throw new Error('The local profile is unreadable on this machine');
    }
  }

  #write(profile) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is unavailable; refusing to store an unprotected profile');
    fs.mkdirSync(path.dirname(this.profilePath), { recursive: true });
    fs.writeFileSync(this.profilePath, this.safeStorage.encryptString(JSON.stringify(profile)), { mode: 0o600 });
  }
}

module.exports = { LocalAuthStore, newRecoveryCode, normalizeRecoveryCode };
