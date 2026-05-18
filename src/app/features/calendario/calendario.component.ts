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
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="view">
      <!-- Month nav -->
      <div class="row-flex">
        <button class="btn btn--ghost btn--icon" (click)="prevMonth()">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <h3 class="serif" style="font-size:24px;font-weight:400;min-width:240px;text-align:center">
          {{ monthName() }} {{ year() }}
        </h3>
        <button class="btn btn--ghost btn--icon" (click)="nextMonth()">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
        <div style="margin-left:auto">
          <button class="btn btn--ghost" style="font-size:11px" (click)="goToToday()">
            {{ i18n.t('calendario.hoy') }}
          </button>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('calendario.pagos_mes') }}</div>
          <div class="num-md" style="margin-top:8px">{{ eventsThisMonth().length }}</div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('calendario.total_comprometido') }}</div>
          <div class="num-md" style="margin-top:8px;color:var(--negative)">
            $ {{ totalCommitted() | number: '1.0-0' }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('calendario.proximo_pago') }}</div>
          <div class="num-md" style="margin-top:8px">{{ nextEvent() }}</div>
        </div>
      </div>

      <!-- Calendar grid -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--line)">
          @for (d of days; track d) {
            <div
              style="padding:8px;text-align:center;font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:.08em;color:var(--fg-3)"
            >
              {{ d }}
            </div>
          }
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr)">
          @for (cell of calendarCells(); track $index) {
            <div
              style="min-height:100px;padding:8px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)"
              [style.background]="cell.day === today.getDate() && isCurrentMonth() ? 'var(--accent-soft)' : ''"
              [style.opacity]="cell.day === 0 ? '0' : '1'"
            >
              @if (cell.day > 0) {
                <div
                  class="mono"
                  style="font-size:12px;margin-bottom:4px"
                  [style.color]="cell.day === today.getDate() && isCurrentMonth() ? 'var(--accent)' : 'var(--fg-2)'"
                >
                  {{ cell.day }}
                </div>
                @for (ev of cell.events; track ev.payee) {
                  <div
                    style="margin-bottom:3px;padding:2px 5px;border-radius:var(--radius-sm);background:var(--bg-2);border-left:2px solid"
                    [style.border-left-color]="
                      ev.kind === 'card' ? 'var(--accent)' : ev.kind === 'loan' ? 'var(--info)' : 'var(--negative)'
                    "
                  >
                    <div
                      style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--fg-0)"
                    >
                      {{ ev.payee }}
                    </div>
                    <div class="mono" style="font-size:9px;color:var(--fg-3)">$ {{ ev.amount | number: '1.0-0' }}</div>
                  </div>
                }
              }
            </div>
          }
        </div>
      </div>

      <!-- Upcoming list -->
      <div class="card" style="padding:0;overflow:hidden">
        <div class="card__h">
          <span class="card__title">{{ i18n.t('calendario.proximos_dias') }}</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th style="width:80px">{{ i18n.t('calendario.table_dia') }}</th>
              <th>{{ i18n.t('calendario.table_concepto') }}</th>
              <th>{{ i18n.t('calendario.table_tipo') }}</th>
              <th class="num">{{ i18n.t('calendario.table_monto') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (ev of upcoming(); track ev.payee + ev.day) {
              <tr>
                <td class="mono" style="font-size:16px;color:var(--fg-0);letter-spacing:-.02em">{{ ev.day }}</td>
                <td style="color:var(--fg-0)">{{ ev.payee }}</td>
                <td>
                  <span
                    class="tag"
                    [class]="ev.kind === 'card' ? 'tag--accent' : ev.kind === 'loan' ? 'tag--info' : ''"
                  >
                    {{
                      ev.kind === 'card'
                        ? i18n.t('calendario.tag_tarjeta')
                        : ev.kind === 'loan'
                          ? i18n.t('calendario.tag_prestamo')
                          : i18n.t('calendario.tag_cuota')
                    }}
                  </span>
                </td>
                <td class="num mono" style="color:var(--negative)">− $ {{ ev.amount | number: '1.0-0' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CalendarioComponent {
  public i18n = inject(I18nService);

  today = new Date();
  currentDate = signal(new Date());
  days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  monthNames = [
    'calendario.mes_enero',
    'calendario.mes_febrero',
    'calendario.mes_marzo',
    'calendario.mes_abril',
    'calendario.mes_mayo',
    'calendario.mes_junio',
    'calendario.mes_julio',
    'calendario.mes_agosto',
    'calendario.mes_septiembre',
    'calendario.mes_octubre',
    'calendario.mes_noviembre',
    'calendario.mes_diciembre',
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
