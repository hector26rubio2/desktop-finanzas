import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, AuthResponse } from './api.service';
import { tap } from 'rxjs';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Access token stored ONLY in memory — never persisted to disk
  private api = inject(ApiService);
  private router = inject(Router);
  private _accessToken: string | null = null;
  readonly currentUser = signal<UserInfo | null>(null);

  constructor() {
    this.tryRestoreSession();
  }

  get accessToken(): string | null {
    return this._accessToken;
  }

  get isAuthenticated(): boolean {
    return this._accessToken !== null;
  }

  loginWithGoogle(idToken: string) {
    return this.api.loginWithGoogle(idToken).pipe(tap((r) => this.handleAuth(r)));
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((r) => this.handleAuth(r)));
  }

  register(name: string, email: string, password: string, baseCurrency: string) {
    return this.api.register(name, email, password, baseCurrency).pipe(tap((r) => this.handleAuth(r)));
  }

  logout() {
    const rt = this.getRefreshToken();
    if (rt) this.api.logout(rt).subscribe();
    this._accessToken = null;
    sessionStorage.removeItem('rt');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  refreshAccessToken() {
    const rt = this.getRefreshToken();
    if (!rt) return null;
    return this.api.refresh(rt).pipe(tap((r) => this.handleAuth(r)));
  }

  private handleAuth(r: AuthResponse) {
    this._accessToken = r.accessToken;
    sessionStorage.setItem('rt', r.refreshToken);
    this.currentUser.set(r.user);
  }

  private getRefreshToken(): string | null {
    return sessionStorage.getItem('rt');
  }

  private tryRestoreSession() {
    const rt = this.getRefreshToken();
    if (!rt) return;
    this.api.refresh(rt).subscribe({
      next: (r) => this.handleAuth(r),
      error: () => sessionStorage.removeItem('rt'),
    });
  }
}
