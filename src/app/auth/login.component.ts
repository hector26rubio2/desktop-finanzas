import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <h1>{{ i18n.t('app.title') }}</h1>
          <p class="eyebrow" style="margin-top: 6px; text-align:center">{{ i18n.t('app.subtitle') }}</p>
        </div>

        <div id="google-btn" style="display:flex;justify-content:center;margin-bottom:1rem"></div>
        @if (googleClientId) {
          <div class="row-flex" style="margin:0 0 1rem;gap:8px">
            <div style="flex:1;height:1px;background:var(--line)"></div>
            <span class="eyebrow">o</span>
            <div style="flex:1;height:1px;background:var(--line)"></div>
          </div>
        }

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            {{ i18n.t('auth.email') }}
            <input type="email" formControlName="email" autocomplete="email" placeholder="vos@ejemplo.com" />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <span class="field-error">{{ i18n.t('auth.invalid_email') }}</span>
            }
          </label>
          <label>
            {{ i18n.t('auth.password') }}
            <input type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <span class="field-error">{{ i18n.t('auth.required') }}</span>
            }
          </label>

          @if (error) {
            <div class="auth-error">{{ error }}</div>
          }

          <button type="submit" class="auth-submit" [disabled]="loading">
            {{ loading ? i18n.t('auth.signing_in') : i18n.t('auth.sign_in') }}
          </button>
        </form>

        <p class="auth-link">
          {{ i18n.t('auth.no_account') }} <a routerLink="/register">{{ i18n.t('auth.create_one') }}</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading = false;
  error: string | null = null;
  googleClientId = environment.googleClientId;

  ngOnInit() {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (this.googleClientId) this.loadGoogleScript();
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.message ?? this.i18n.t('auth.login_error');
        this.loading = false;
      },
    });
  }

  private loadGoogleScript() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (r: { credential: string }) => this.handleGoogleCallback(r),
      });
      google.accounts.id.renderButton(document.getElementById('google-btn'), {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
      });
    };
    document.head.appendChild(script);
  }

  private handleGoogleCallback(response: { credential: string }) {
    this.loading = true;
    this.auth.loginWithGoogle(response.credential).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error = this.i18n.t('auth.google_error');
        this.loading = false;
      },
    });
  }
}
