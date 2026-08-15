import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

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
    password: ['', Validators.required],
    remember: [false],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  passwordVisible = signal(false);

  hasProfile = signal<boolean | null>(null);

  async ngOnInit() {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/dashboard']);
      return;
    }
    const status = await this.auth.status().catch(() => null);
    if (!status) {
      this.error.set(this.i18n.t('auth.login_error'));
      this.hasProfile.set(false);
      return;
    }
    this.hasProfile.set(status.hasProfile);
    if (!status.hasProfile) this.router.navigate(['/register']);
  }

  togglePassword() {
    this.passwordVisible.update((v) => !v);
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { password, remember } = this.form.value;
    this.auth
      .login(password!, remember ?? false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: () => {
          this.error.set(this.i18n.t('auth.login_error'));
          this.loading.set(false);
        },
      });
  }
}
