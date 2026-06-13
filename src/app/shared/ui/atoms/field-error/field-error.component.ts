import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  standalone: true,
  template: ` @if (control() && control()!.invalid && (control()!.touched || control()!.dirty)) {
    <span class="field-error">{{ message() }}</span>
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
  control = input.required<AbstractControl | null>();
  message = input('Este campo es requerido');
}
