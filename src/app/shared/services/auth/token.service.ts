import { Injectable, signal } from '@angular/core';
import type { UserInfo } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private _accessToken: string | null = null;
  readonly currentUser = signal<UserInfo | null>(null);

  get accessToken(): string | null {
    return this._accessToken;
  }

  get isAuthenticated(): boolean {
    return this._accessToken !== null;
  }

  set(token: string, user: UserInfo): void {
    this._accessToken = token;
    // El backend no expone aún actualización de moneda base: se respeta la preferencia local
    const pref = localStorage.getItem('pref-base-currency');
    this.currentUser.set(pref ? { ...user, baseCurrency: pref } : user);
  }

  updateBaseCurrency(code: string): void {
    localStorage.setItem('pref-base-currency', code);
    const u = this.currentUser();
    if (u) this.currentUser.set({ ...u, baseCurrency: code });
  }

  clear(): void {
    this._accessToken = null;
    this.currentUser.set(null);
  }
}
