import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, AuthResponse } from '../api.service';
import { tap } from 'rxjs';
import { TokenService } from './token.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private token = inject(TokenService);
  private session = inject(SessionService);

  constructor() {
    this.tryRestoreSession();
  }

  get accessToken(): string | null {
    return this.token.accessToken;
  }

  get isAuthenticated(): boolean {
    return this.token.isAuthenticated;
  }

  get currentUser() {
    return this.token.currentUser;
  }

  get hasStoredToken(): boolean {
    return this.session.hasStoredToken;
  }

  login(email: string, password: string, remember = false) {
    return this.api.login(email, password).pipe(tap((r) => this.handleAuth(r, remember)));
  }

  loginWithGoogle(idToken: string) {
    return this.api.loginWithGoogle(idToken).pipe(tap((r) => this.handleAuth(r)));
  }

  register(name: string, email: string, password: string, baseCurrency: string) {
    return this.api.register(name, email, password, baseCurrency);
  }

  forgotPassword(email: string) {
    return this.api.forgotPassword(email);
  }

  resetPassword(token: string, password: string) {
    return this.api.resetPassword(token, password);
  }

  verifyEmail(token: string) {
    return this.api.verifyEmail(token);
  }

  resendVerification(email: string) {
    return this.api.resendVerification(email);
  }

  logout() {
    const rt = this.session.getRefreshToken();
    this.token.clear();
    this.session.clear();
    this.router.navigate(['/login']);
    if (rt) this.api.logout(rt).subscribe({ error: () => {} });
  }

  refreshAccessToken() {
    const rt = this.session.getRefreshToken();
    if (!rt) return null;
    return this.api.refresh(rt).pipe(tap((r) => this.handleAuth(r)));
  }

  private handleAuth(r: AuthResponse, remember = false) {
    this.token.set(r.accessToken, r.user);
    this.session.saveRefreshToken(r.refreshToken, remember);
  }

  private tryRestoreSession() {
    if (!this.session.hasStoredToken) return;
    const rt = this.session.getRefreshToken();
    if (!rt) return;
    this.api.refresh(rt).subscribe({
      next: (r) => this.token.set(r.accessToken, r.user),
      error: () => this.session.clear(),
    });
  }
}
