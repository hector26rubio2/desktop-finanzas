import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthApiService } from '../api/auth-api.service';
import type { AuthResponse } from '../../models/auth.model';
import { from, switchMap, EMPTY } from 'rxjs';
import { TokenService } from './token.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(AuthApiService);
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
    return this.api.login(email, password).pipe(
      switchMap(async (r) => {
        await this.handleAuth(r, remember);
        return r;
      }),
    );
  }

  loginWithGoogle(idToken: string) {
    return this.api.loginWithGoogle(idToken).pipe(
      switchMap(async (r) => {
        await this.handleAuth(r);
        return r;
      }),
    );
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

  async logout() {
    const rt = await this.session.getRefreshToken();
    this.token.clear();
    this.session.clear();
    this.router.navigate(['/login']);
    if (rt) this.api.logout(rt).subscribe({ error: () => {} });
  }

  refreshAccessToken() {
    return from(this.session.getRefreshToken()).pipe(
      switchMap((rt) => {
        if (!rt) return EMPTY;
        return this.api.refresh(rt).pipe(
          switchMap(async (r) => {
            await this.handleAuth(r, false);
            return r;
          }),
        );
      }),
    );
  }

  private async handleAuth(r: AuthResponse, remember = false) {
    this.token.set(r.accessToken, r.user);
    await this.session.saveRefreshToken(r.refreshToken, remember);
  }

  private tryRestoreSession() {
    if (!this.session.hasStoredToken) return;
    from(this.session.getRefreshToken()).subscribe({
      next: (rt) => {
        if (!rt) return;
        this.api.refresh(rt).subscribe({
          next: (r) => this.token.set(r.accessToken, r.user),
          error: () => this.session.clear(),
        });
      },
    });
  }
}
