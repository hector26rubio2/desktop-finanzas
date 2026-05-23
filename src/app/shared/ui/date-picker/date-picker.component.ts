import { Component, input, output, computed, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../i18n/i18n.service';

export type PickerMode = 'year' | 'month' | 'day';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerComponent {
  granularity = input<'year' | 'month' | 'week' | 'day'>('month');
  activeLabelKey = input('');
  i18n = inject(I18nService);

  show = signal(false);
  pickerYear = signal(new Date().getFullYear());
  pickerMonth = signal(new Date().getMonth());
  pickerMode = signal<'year' | 'month'>('month');

  selectDate = output<string>();
  closePicker = output<void>();

  MONTHS = computed(() => {
    const loc = this.i18n.currentLocale();
    const fmt = new Intl.DateTimeFormat(loc === 'en-US' ? 'en' : loc === 'pt-BR' ? 'pt' : 'es', { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2024, i, 1);
      const s = fmt.format(d);
      return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
    });
  });

  DAYS = computed(() => {
    const loc = this.i18n.currentLocale();
    const fmt = new Intl.DateTimeFormat(loc === 'en-US' ? 'en' : loc === 'pt-BR' ? 'pt' : 'es', { weekday: 'short' });
    const base = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const s = fmt.format(d);
      return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
    });
  });

  yearList = computed(() => {
    const y = this.pickerYear();
    const start = Math.floor(y / 9) * 9;
    return Array.from({ length: 9 }, (_, i) => start + i);
  });

  dayGrid = computed(() => {
    const y = this.pickerYear(), m = this.pickerMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const off = first === 0 ? 6 : first - 1;
    const cells: (number | null)[] = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  });

  open() {
    const g = this.granularity();
    if (g === 'month' || g === 'day') {
      const parts = this.activeLabelKey().split('-').map(Number);
      if (parts.length >= 2) {
        this.pickerYear.set(parts[0]);
        this.pickerMonth.set(parts[1] - 1);
      }
    }
    this.pickerMode.set('month');
    this.show.set(true);
  }

  onClose() {
    this.show.set(false);
    this.closePicker.emit();
  }

  selectMonth(m: number) {
    const key = `${this.pickerYear()}-${String(m + 1).padStart(2, '0')}-01`;
    this.selectDate.emit(key);
    this.show.set(false);
  }

  selectDay(d: number) {
    const y = this.pickerYear(), m = this.pickerMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    this.selectDate.emit(key);
    this.show.set(false);
  }

  selectYear(y: number) {
    if (this.granularity() === 'year') {
      this.selectDate.emit(`${y}-01-01`);
      this.show.set(false);
    } else {
      this.pickerYear.set(y);
      this.pickerMode.set('month');
    }
  }

  pickerPrevMonth() {
    if (this.pickerMonth() === 0) { this.pickerMonth.set(11); this.pickerYear.update(y => y - 1); }
    else { this.pickerMonth.update(m => m - 1); }
  }

  pickerNextMonth() {
    if (this.pickerMonth() === 11) { this.pickerMonth.set(0); this.pickerYear.update(y => y + 1); }
    else { this.pickerMonth.update(m => m + 1); }
  }

  isToday(d: number | null) {
    if (!d) return false;
    const n = new Date();
    return n.getFullYear() === this.pickerYear() && n.getMonth() === this.pickerMonth() && n.getDate() === d;
  }

  isDayActive(d: number | null) {
    if (!d) return false;
    const parts = this.activeLabelKey().split('-').map(Number);
    if (parts.length < 3) return false;
    return parts[0] === this.pickerYear() && (parts[1] - 1) === this.pickerMonth() && parts[2] === d;
  }

  isMonthActive(m: number) {
    const parts = this.activeLabelKey().split('-').map(Number);
    if (parts.length < 2) return false;
    return parts[0] === this.pickerYear() && (parts[1] - 1) === m;
  }

  isYearActive(y: number) {
    return y === +this.activeLabelKey().slice(0, 4);
  }
}