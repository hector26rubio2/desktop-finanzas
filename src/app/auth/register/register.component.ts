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
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    // Sin servidor no hay correo que verificar: queda como etiqueta opcional.
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
    baseCurrency: ['COP', [Validators.required, Validators.pattern(/^[A-Z]{3,4}$/)]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  /** El código solo existe en memoria y solo hasta que el usuario confirme haberlo guardado. */
  recoveryCode = signal<string | null>(null);
  recoveryAcknowledged = signal(false);

  async ngOnInit() {
    const status = await this.auth.status().catch(() => null);
    if (status?.hasProfile) {
      this.router.navigate(['/login']);
      return;
    }
    if (status?.suggestedName) this.form.patchValue({ name: status.suggestedName });
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const v = this.form.value;
    this.auth
      .register(v.name!, v.email ?? '', v.password!, v.baseCurrency!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enrollment) => {
          this.loading.set(false);
          this.recoveryCode.set(enrollment.recoveryCode);
        },
        error: () => {
          this.error.set(this.i18n.t('auth.register_error'));
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
