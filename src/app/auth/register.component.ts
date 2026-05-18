import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <h1>{{ i18n.t('app.title') }}</h1>
          <p class="eyebrow" style="margin-top:6px;text-align:center">{{ i18n.t('auth.register') }}</p>
        </div>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            {{ i18n.t('auth.name') }}
            <input formControlName="name" [placeholder]="i18n.t('auth.name')" />
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <span class="field-error">{{ i18n.t('auth.required') }}</span>
            }
          </label>
          <label>
            {{ i18n.t('auth.email') }}
            <input type="email" formControlName="email" autocomplete="email" placeholder="vos@ejemplo.com" />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <span class="field-error">{{ i18n.t('auth.invalid_email') }}</span>
            }
          </label>
          <label>
            {{ i18n.t('auth.password') }}
            <input
              type="password"
              formControlName="password"
              autocomplete="new-password"
              [placeholder]="i18n.t('auth.min_length')"
            />
            @if (form.get('password')?.errors?.['required'] && form.get('password')?.touched) {
              <span class="field-error">{{ i18n.t('auth.required') }}</span>
            }
            @if (form.get('password')?.errors?.['minlength'] && form.get('password')?.touched) {
              <span class="field-error">{{ i18n.t('auth.min_length') }}</span>
            }
            @if (form.get('password')?.errors?.['pattern'] && form.get('password')?.touched) {
              <span class="field-error">{{ i18n.t('auth.need_number') }}</span>
            }
          </label>
          <label>
            {{ i18n.t('auth.base_currency') }}
            <select formControlName="baseCurrency">
              <option value="ARS">ARS — Peso argentino</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="COP">COP — Peso colombiano</option>
            </select>
          </label>

          @if (error) {
            <div class="auth-error">{{ error }}</div>
          }

          <button type="submit" class="auth-submit" [disabled]="loading">
            {{ loading ? i18n.t('auth.registering') : i18n.t('auth.register') }}
          </button>
        </form>

        <p class="auth-link">
          {{ i18n.t('auth.have_account') }} <a routerLink="/login">{{ i18n.t('auth.login_link') }}</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
    baseCurrency: ['ARS', Validators.required],
  });

  loading = false;
  error: string | null = null;

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const v = this.form.value;
    this.auth.register(v.name!, v.email!, v.password!, v.baseCurrency!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.message ?? this.i18n.t('auth.register_error');
        this.loading = false;
      },
    });
  }
}
