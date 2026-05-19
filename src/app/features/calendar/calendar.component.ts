import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { TranslationKey } from '../../shared/i18n/locale.types';

interface CalEvent {
  day: number;
  payee: string;
  amount: number;
  ccy: string;
  kind: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent {
  public i18n = inject(I18nService);

  today = new Date();
  currentDate = signal(new Date());
  days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  monthNames = [
    'calendar.mes_enero',
    'calendar.mes_febrero',
    'calendar.mes_marzo',
    'calendar.mes_abril',
    'calendar.mes_mayo',
    'calendar.mes_junio',
    'calendar.mes_julio',
    'calendar.mes_agosto',
    'calendar.mes_septiembre',
    'calendar.mes_octubre',
    'calendar.mes_noviembre',
    'calendar.mes_diciembre',
  ];

  month() {
    return this.currentDate().getMonth();
  }
  year() {
    return this.currentDate().getFullYear();
  }
  monthName() {
    return this.i18n.t(this.monthNames[this.month()] as TranslationKey);
  }
  isCurrentMonth() {
    return this.month() === this.today.getMonth() && this.year() === this.today.getFullYear();
  }

  // Sample events
  private events: CalEvent[] = [
    { day: 24, payee: 'Visa Galicia', amount: 1248904, ccy: 'ARS', kind: 'card' },
    { day: 6, payee: 'Amex Gold', amount: 384220, ccy: 'ARS', kind: 'card' },
    { day: 1, payee: 'Naranja X', amount: 422800, ccy: 'ARS', kind: 'card' },
    { day: 14, payee: 'Préstamo Personal', amount: 248440, ccy: 'ARS', kind: 'loan' },
    { day: 22, payee: 'Prendario Auto', amount: 412800, ccy: 'ARS', kind: 'loan' },
    { day: 5, payee: 'MacBook Pro cuota 4/12', amount: 183, ccy: 'USD', kind: 'cuota' },
  ];

  eventsThisMonth() {
    return this.events;
  }
  totalCommitted() {
    return this.events.reduce((s, e) => s + e.amount, 0);
  }
  nextEvent() {
    const today = this.today.getDate();
    const next = this.events.filter((e) => e.day >= today).sort((a, b) => a.day - b.day)[0];
    return next ? `${next.day} — ${next.payee}` : '—';
  }

  upcoming() {
    return this.events
      .slice()
      .sort((a, b) => a.day - b.day)
      .slice(0, 8);
  }

  calendarCells() {
    const year = this.year();
    const month = this.month();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; events: CalEvent[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: 0, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, events: this.events.filter((e) => e.day === d) });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, events: [] });
    return cells;
  }

  prevMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  nextMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  goToToday() {
    this.currentDate.set(new Date());
  }
}

