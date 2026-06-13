import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { environment } from '@env/environment';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

declare const google: {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  googleClientId = environment.googleClientId;
  passwordVisible = signal(false);

  ngOnInit() {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (this.googleClientId) this.loadGoogleScript();
  }

  togglePassword() {
    this.passwordVisible.update((v) => !v);
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password, remember } = this.form.value;
    this.auth
      .login(email!, password!, remember ?? false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: () => {
          this.error.set(this.i18n.t('auth.login_error'));
          this.loading.set(false);
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
      const btn = document.getElementById('google-btn');
      if (!btn) return;
      google.accounts.id.renderButton(btn, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 392,
        ux_mode: 'popup',
      });
    };
    document.head.appendChild(script);
  }

  private handleGoogleCallback(response: { credential: string }) {
    this.loading.set(true);
    this.auth
      .loginWithGoogle(response.credential)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: () => {
          this.error.set(this.i18n.t('auth.google_error'));
          this.loading.set(false);
        },
      });
  }
}
