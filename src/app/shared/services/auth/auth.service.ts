import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalAuthService } from './local-auth.service';
import type { LocalAuthSession, LocalAuthStatus } from '../../models/auth.model';
import { switchMap } from 'rxjs';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { RecurringTransactionsApiService } from '../api/recurring-transactions-api.service';
import { BaseCurrencyPolicyService } from '../base-currency-policy.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private local = inject(LocalAuthService);
  private router = inject(Router);
  private token = inject(TokenService);
  private session = inject(SessionService);
  private recurring = inject(RecurringTransactionsApiService);
  private baseCurrencyPolicy = inject(BaseCurrencyPolicyService);

  private readonly restored: Promise<void>;

  constructor() {
    this.restored = this.tryRestoreSession();
  }

  whenReady(): Promise<void> {
    return this.restored;
  }

  get isAuthenticated(): boolean {
    return this.token.isAuthenticated;
  }

  get currentUser() {
    return this.token.currentUser;
  }

  readonly baseCurrency = computed(() => this.token.currentUser()?.baseCurrency ?? 'COP');

  get hasStoredToken(): boolean {
    return this.session.hasStoredToken;
  }

  status(): Promise<LocalAuthStatus> {
    return this.local.status();
  }

  setBaseCurrency(code: string) {
    return this.baseCurrencyPolicy.change(code);
  }

  login(password: string, remember = false) {
    return this.local.login(password, remember).pipe(
      switchMap(async (session) => {
        await this.handleAuth(session, remember);
        return session;
      }),
    );
  }

  register(name: string, email: string, password: string, baseCurrency: string) {
    return this.local.register(name, email, password, baseCurrency).pipe(
      switchMap(async (enrollment) => {
        await this.handleAuth(enrollment, false);
        return enrollment;
      }),
    );
  }

  recover(recoveryCode: string, newPassword: string) {
    return this.local.recover(recoveryCode, newPassword).pipe(
      switchMap(async (enrollment) => {
        await this.handleAuth(enrollment, false);
        return enrollment;
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.local.changePassword(currentPassword, newPassword);
  }

  async logout() {
    this.token.clear();
    this.session.clear();
    await this.local.logout();
    this.router.navigate(['/login']);
  }

  private async handleAuth(session: LocalAuthSession, remember: boolean) {
    this.token.set(session.user);
    if (remember && session.resumeToken) await this.session.saveResumeToken(session.resumeToken, true);
    else this.session.clear();
    await this.materializeRecurring();
  }

  private async tryRestoreSession(): Promise<void> {
    if (!this.session.hasStoredToken) return;
    const resumeToken = await this.session.getResumeToken();
    if (!resumeToken) return;
    const session = await this.local.resume(resumeToken).catch(() => null);
    if (!session) {
      this.session.clear();
      return;
    }
    this.token.set(session.user);
    await this.materializeRecurring();
  }

  private async materializeRecurring(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        this.recurring.materializeDue().subscribe({ next: () => resolve(), error: () => resolve() });
      });
    } catch {}
  }
}
