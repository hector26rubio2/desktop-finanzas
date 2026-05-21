import { Injectable, signal } from '@angular/core';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: string;
}

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
    this.currentUser.set(user);
  }

  clear(): void {
    this._accessToken = null;
    this.currentUser.set(null);
  }
}
