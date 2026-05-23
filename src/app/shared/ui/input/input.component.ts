import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-input',
  standalone: true,
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputComponent {
  label = input('');
  type = input('text');
  placeholder = input('');
  value = input('');
  disabled = input(false);
  required = input(false);
  min = input<string | number | null>(null);
  step = input<string | number | null>(null);
  valueChange = output<string>();

  onInput(e: Event): void {
    this.valueChange.emit((e.target as HTMLInputElement).value);
  }
}