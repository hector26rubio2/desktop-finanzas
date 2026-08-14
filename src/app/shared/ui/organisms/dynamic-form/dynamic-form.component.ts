import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  form = input.required<FormGroup>();
  fields = input.required<DynamicField[]>();
  submitLabel = input('Guardar');
  busy = input(false);
  cancelled = output<void>();
  submitted = output<Record<string, unknown>>();
  visibleFields() {
    return this.fields().filter((f) => !f.visibleWhen || f.visibleWhen(this.form().getRawValue()));
  }
  submit() {
    this.form().markAllAsTouched();
    if (this.form().valid) this.submitted.emit(this.form().getRawValue());
  }
}
