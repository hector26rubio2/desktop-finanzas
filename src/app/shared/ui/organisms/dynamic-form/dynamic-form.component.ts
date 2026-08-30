import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../i18n/i18n.service';
export type DynamicFieldType = 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'checkbox';
export interface DynamicField {
  key: string;
  label: string;
  type: DynamicFieldType;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  fullWidth?: boolean;
  visibleWhen?: (value: Record<string, unknown>) => boolean;
}
@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.css',
})
export class DynamicFormComponent {
  readonly i18n = inject(I18nService);
  form = input.required<FormGroup>();
  fields = input.required<DynamicField[]>();
  submitLabel = input('');
  busy = input(false);
  cancelled = output<void>();
  submitted = output<Record<string, unknown>>();

  visibleFields() {
    return this.fields().filter((f) => !f.visibleWhen || f.visibleWhen(this.form().getRawValue()));
  }

  errorFor(field: DynamicField): string | null {
    const control = this.form().get(field.key);
    if (!control || !control.touched || !control.errors) return null;
    const errors = control.errors;
    if (errors['required']) return this.i18n.t('validation.required');
    if (errors['min']) return `${this.i18n.t('validation.min')} ${errors['min'].min}`;
    if (errors['max']) return `${this.i18n.t('validation.max')} ${errors['max'].max}`;
    if (errors['pattern']) return this.i18n.t('validation.pattern');
    if (errors['email']) return this.i18n.t('validation.email');
    return this.i18n.t('validation.invalid');
  }

  blockInvalidNumber(field: DynamicField, event: KeyboardEvent): void {
    if (field.type !== 'number') return;
    if (['e', 'E', '+'].includes(event.key)) event.preventDefault();
    if (event.key === '-' && (field.min ?? 0) >= 0) event.preventDefault();
  }

  submit() {
    this.form().markAllAsTouched();
    if (this.form().valid) this.submitted.emit(this.form().getRawValue());
  }

  resolvedSubmitLabel(): string {
    return this.submitLabel() || this.i18n.t('common.save');
  }
}
