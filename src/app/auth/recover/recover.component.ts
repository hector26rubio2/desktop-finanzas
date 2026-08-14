import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

/**
 * Recuperación con el código emitido al crear el perfil. No hay correo de
 * restablecimiento porque no hay servidor que lo envíe: este código es la única
 * vuelta atrás, y al usarse se emite uno nuevo.
 */
@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './recover.component.html',
  styleUrl: './recover.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoverComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    recoveryCode: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  recoveryCode = signal<string | null>(null);
  recoveryAcknowledged = signal(false);

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { recoveryCode, newPassword } = this.form.value;
    this.auth
      .recover(recoveryCode!, newPassword!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enrollment) => {
          this.loading.set(false);
          this.form.reset();
          // El código anterior ya no sirve; este lo reemplaza.
          this.recoveryCode.set(enrollment.recoveryCode);
        },
        error: () => {
          this.error.set(this.i18n.t('auth.recover_error'));
          this.loading.set(false);
        },
      });
  }

  finish() {
    if (!this.recoveryAcknowledged()) return;
    this.recoveryCode.set(null);
    this.router.navigate(['/dashboard']);
  }

  acknowledge(checked: boolean) {
    this.recoveryAcknowledged.set(checked);
  }
}
