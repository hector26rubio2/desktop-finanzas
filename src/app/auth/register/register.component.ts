import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
    baseCurrency: ['ARS', [Validators.required, Validators.pattern(/^[A-Z]{3,4}$/)]],
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
      next: (res) => this.router.navigate(['/verify-email'], { state: { email: res.user.email } }),
      error: (err) => {
        this.error = err.error?.message ?? this.i18n.t('auth.register_error');
        this.loading = false;
      },
    });
  }
}
