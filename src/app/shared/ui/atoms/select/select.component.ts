import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectComponent {
  label = input('');
  disabled = input(false);
  required = input(false);
  valueChange = output<string>();

  onChange(e: Event): void {
    this.valueChange.emit((e.target as HTMLSelectElement).value);
  }
}
