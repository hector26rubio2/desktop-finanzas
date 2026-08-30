import { Injectable, signal } from '@angular/core';
import type { UserInfo } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class TokenService {
  readonly currentUser = signal<UserInfo | null>(null);

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  set(user: UserInfo): void {
    const pref = localStorage.getItem('pref-base-currency');
    this.currentUser.set(pref ? { ...user, baseCurrency: pref } : user);
  }

  updateBaseCurrency(code: string): void {
    localStorage.setItem('pref-base-currency', code);
    const u = this.currentUser();
    if (u) this.currentUser.set({ ...u, baseCurrency: code });
  }

  clear(): void {
    this.currentUser.set(null);
  }
}
