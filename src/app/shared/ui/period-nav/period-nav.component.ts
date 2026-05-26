import { Component, input, output, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../i18n/i18n.service';
import { DatePickerComponent } from '../date-picker/date-picker.component';

@Component({
  selector: 'app-period-nav',
  standalone: true,
  imports: [CommonModule, DatePickerComponent],
  templateUrl: './period-nav.component.html',
  styleUrl: './period-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodNavComponent {
  label = input('');
  granularity = input<'year' | 'month' | 'week' | 'day'>('month');
  activeLabelKey = input('');
  prev = output<void>();
  next = output<void>();
  selectDate = output<string>();
  i18n = inject(I18nService);
  showPicker = signal(false);

  togglePicker() {
    this.showPicker.update((v) => !v);
  }
}
