import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  loading = false;
  success = false;
  error: string | null = null;
  token: string | null = null;

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.error = this.i18n.t('auth.login_error');
    } else {
      this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.token) return;
    this.loading = true;
    this.error = null;
    this.auth.resetPassword(this.token, this.form.value.password!).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.error =
          err.error?.error === 'invalid_token'
            ? this.i18n.t('auth.login_error')
            : (err.error?.message ?? this.i18n.t('auth.login_error'));
        this.loading = false;
      },
    });
  }
}
