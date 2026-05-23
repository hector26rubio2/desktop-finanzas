import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'app-granularity-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './granularity-selector.component.html',
  styleUrl: './granularity-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GranularitySelectorComponent {
  options = input<{ key: string; keyLabel: string }[]>([]);
  active = input<string>('month');
  selectionChange = output<string>();
  i18n = inject(I18nService);
}