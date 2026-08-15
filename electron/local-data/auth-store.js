const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROFILE_VERSION = 1;

const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

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

    for (const byte of crypto.randomBytes(RECOVERY_GROUP_LENGTH)) chunk += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    groups.push(chunk);
  }
  return groups.join('-');
}

function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

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

      suggestedName: profile?.user.name || os.userInfo().username || '',
      unlocked: this.session !== null,
      lockedUntil: this.lockedUntil > Date.now() ? this.lockedUntil : 0,

      orphanOwners: profile ? [] : existingOwners,
    };
  }

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

    return { ...this.#open(profile, false), recoveryCode };
  }

  login({ password, remember = false }) {
    this.#assertNotLockedOut();
    const profile = this.#requireProfile();
    if (!verifySecret(String(password || ''), profile.password)) return this.#rejectAttempt();
    this.failedAttempts = 0;
    return this.#open(profile, remember);
  }

  resume(resumeToken) {
    const profile = this.#read();
    if (!profile?.resume || !resumeToken) return null;
    if (!verifySecret(String(resumeToken), profile.resume)) {

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

    this.#write({ ...profile, password: hashSecret(newPassword), resume: null });
    return { ok: true };
  }

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
