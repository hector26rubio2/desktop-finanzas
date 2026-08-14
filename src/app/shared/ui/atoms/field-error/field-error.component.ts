import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { I18nService } from '../../../i18n/i18n.service';

/**
 * Muestra el error de validación de un control reactivo.
 * Deriva el mensaje del tipo de error (required/email/min/max/...) vía i18n.
 * Uso: <app-field-error [control]="form.get('campo')" />
 * Opcional: [message]="'texto fijo'" para override.
 */
@Component({
  selector: 'app-field-error',
  standalone: true,
  template: `@if (visible()) {
    <span class="field-error" role="alert">{{ msg() }}</span>
  }`,
  styles: [
    `
      .field-error {
        display: block;
        font-size: 11px;
        color: var(--negative);
        margin-top: 4px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldErrorComponent {
  private i18n = inject(I18nService);

  control = input.required<AbstractControl | null>();
  /** Override opcional de mensaje (compat con usos previos). */
  message = input<string>('');

  // Métodos (no computed): se re-evalúan en cada CD del form → reflejan cambios de validez.
  visible(): boolean {
    const c = this.control();
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  msg(): string {
    const override = this.message();
    if (override) return override;
    const e = this.control()?.errors;
    if (!e) return '';
    if (e['required']) return this.i18n.t('validation.required');
    if (e['email']) return this.i18n.t('validation.email');
    if (e['minlength']) return `${this.i18n.t('validation.min_length')} ${e['minlength'].requiredLength}`;
    if (e['maxlength']) return `${this.i18n.t('validation.max_length')} ${e['maxlength'].requiredLength}`;
    if (e['min']) return `${this.i18n.t('validation.min')} ${e['min'].min}`;
    if (e['max']) return `${this.i18n.t('validation.max')} ${e['max'].max}`;
    if (e['pattern']) return this.i18n.t('validation.pattern');
    return this.i18n.t('validation.invalid');
  }
}
