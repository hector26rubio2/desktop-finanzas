import { Injectable } from '@angular/core';

const KEY = 'rt';

function obfuscate(value: string): string {
  const chars = value.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 256)));
  return btoa(chars.join(''));
}

function deobfuscate(encoded: string): string {
  const chars = atob(encoded)
    .split('')
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 256)));
  return chars.join('');
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private _hasStoredToken = false;

  constructor() {
    this._hasStoredToken = localStorage.getItem(KEY) !== null || sessionStorage.getItem(KEY) !== null;
  }

  get hasStoredToken(): boolean {
    return this._hasStoredToken;
  }

  getRefreshToken(): string | null {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return deobfuscate(raw);
    } catch {
      this.clear();
      return null;
    }
  }

  saveRefreshToken(token: string, remember: boolean): void {
    const encoded = obfuscate(token);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(KEY, encoded);
    this._hasStoredToken = true;
  }

  clear(): void {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    this._hasStoredToken = false;
  }
}
