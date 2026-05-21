import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  sent = false;
  error: string | null = null;

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    this.auth.forgotPassword(this.form.value.email!).subscribe({
      next: () => {
        this.sent = true;
        this.loading = false;
      },
      error: () => {
        this.sent = true;
        this.loading = false;
      },
    });
  }
}
