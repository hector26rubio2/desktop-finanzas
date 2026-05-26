import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  ViewChild,
  ElementRef,
  inject,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { parseDate } from '../../shared/utils/date';
import { AuthService } from '../../shared/services/auth/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { DashboardService, type Granularity } from '../../shared/services/dashboard.service';
import { sourceLabel } from '../../shared/utils/movement-labels';
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') pieCanvasRef!: ElementRef<HTMLCanvasElement>;

  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  public ds = inject(DashboardService);

  baseCurrency = this.auth.currentUser()?.baseCurrency ?? 'ARS';

  granularities: { key: Granularity; keyLabel: string }[] = [
    { key: 'day', keyLabel: 'dashboard.gran_day' },
    { key: 'week', keyLabel: 'dashboard.gran_week' },
    { key: 'month', keyLabel: 'dashboard.gran_month' },
    { key: 'year', keyLabel: 'dashboard.gran_year' },
  ];

  showPicker = signal(false);
  pickerYear = signal(new Date().getFullYear());
  pickerMonth = signal(new Date().getMonth());
  pickerMode = signal<'month' | 'year'>('month');

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

  topLabelKey = computed(() => {
    const g = this.ds.granularity();
    return g === 'day' ? 'dashboard.fecha' : g === 'week' ? 'dashboard.concepto' : 'dashboard.mes_mas_gasto';
  });

  cashflowSubtitle = computed(() => {
    const g = this.ds.granularity();
    if (g === 'year') return this.i18n.t('dashboard.subtitle_year');
    if (g === 'month') return this.i18n.t('dashboard.subtitle_month');
    if (g === 'week') return this.i18n.t('dashboard.subtitle_week');
    return this.i18n.t('dashboard.subtitle_day');
  });

  yearList = computed(() => {
    const y = this.pickerYear();
    const start = Math.floor(y / 9) * 9;
    return Array.from({ length: 9 }, (_, i) => start + i);
  });

  dayGrid = computed(() => {
    const y = this.pickerYear(),
      m = this.pickerMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const off = first === 0 ? 6 : first - 1;
    const cells: (number | null)[] = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  });

  togglePicker() {
    if (!this.showPicker()) {
      const g = this.ds.granularity();
      if (g === 'month' || g === 'day') {
        const [y, m] = this.ds.currentLabelKey().split('-').map(Number);
        this.pickerYear.set(y);
        this.pickerMonth.set(m - 1);
      }
      this.pickerMode.set('month');
    }
    this.showPicker.update((v) => !v);
  }

  closePicker() {
    this.showPicker.set(false);
  }

  pickerPrevMonth() {
    if (this.pickerMonth() === 0) {
      this.pickerMonth.set(11);
      this.pickerYear.update((y) => y - 1);
    } else {
      this.pickerMonth.update((m) => m - 1);
    }
  }

  pickerNextMonth() {
    if (this.pickerMonth() === 11) {
      this.pickerMonth.set(0);
      this.pickerYear.update((y) => y + 1);
    } else {
      this.pickerMonth.update((m) => m + 1);
    }
  }

  selectMonth(m: number) {
    this.ds.jumpTo(`${this.pickerYear()}-${String(m + 1).padStart(2, '0')}-01`);
    this.closePicker();
  }

  selectDay(d: number) {
    const y = this.pickerYear(),
      m = this.pickerMonth();
    this.ds.jumpTo(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    this.closePicker();
  }

  selectYear(y: number) {
    if (this.ds.granularity() === 'year') {
      this.ds.jumpTo(`${y}-01-01`);
      this.closePicker();
    } else {
      this.pickerYear.set(y);
      this.pickerMode.set('month');
    }
  }

  isToday(d: number | null) {
    if (!d) return false;
    const n = new Date();
    return n.getFullYear() === this.pickerYear() && n.getMonth() === this.pickerMonth() && n.getDate() === d;
  }

  isDayActive(d: number | null) {
    if (!d) return false;
    const [cy, cm, cd] = this.ds.currentLabelKey().split('-').map(Number);
    return cy === this.pickerYear() && cm - 1 === this.pickerMonth() && cd === d;
  }

  isMonthActive(m: number) {
    const [cy, cm] = this.ds.currentLabelKey().split('-').map(Number);
    return cy === this.pickerYear() && cm - 1 === m;
  }

  isYearActive(y: number) {
    return y === +this.ds.currentLabelKey().slice(0, 4);
  }

  private lineChart?: Chart;
  private pieChart?: Chart;

  constructor() {
    effect(() => {
      const data = this.ds.lineData();
      const cats = this.ds.categoryExpenses();
      if (!this.ds.loading() && (data.length || cats.length)) {
        setTimeout(() => this.renderCharts(), 50);
      }
    });
  }

  ngOnInit() {
    this.ds.load();
  }
  ngOnDestroy() {
    this.lineChart?.destroy();
    this.pieChart?.destroy();
  }

  fmtDate(dateStr: string): string {
    const d = parseDate(dateStr);
    return d.toLocaleDateString(
      this.i18n.currentLocale() === 'pt-BR' ? 'pt-BR' : this.i18n.currentLocale() === 'en-US' ? 'en-US' : 'es-AR',
      { day: 'numeric', month: 'short' },
    );
  }

  fmtDateTime(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString(
      this.i18n.currentLocale() === 'pt-BR' ? 'pt-BR' : this.i18n.currentLocale() === 'en-US' ? 'en-US' : 'es-AR',
      { day: 'numeric', month: 'short' },
    );
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${date} ${hours}:${mins}`;
  }

  catName(cat: { name: string; translations: any }): string {
    return this.i18n.catName(cat.name, cat.translations);
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private renderCharts() {
    try {
      const textColor = this.cssVar('--fg-3') || 'oklch(40% 0.008 80)';
      const gridColor = this.cssVar('--line-1') || 'oklch(100% 0 0 / 0.08)';
      const positive = this.cssVar('--positive') || 'oklch(76% 0.14 145)';
      const negative = this.cssVar('--negative') || 'oklch(70% 0.16 25)';
      const accent = this.cssVar('--accent') || 'oklch(80% 0.12 78)';
      const accent2 = this.cssVar('--accent-2') || 'oklch(78% 0.1 198)';
      const accent3 = this.cssVar('--accent-3') || 'oklch(76% 0.1 318)';

      if (this.lineCanvasRef) {
        this.lineChart?.destroy();
        const data = this.ds.lineData();
        const g = this.ds.granularity();
        const maxTicksLimit = g === 'day' ? 12 : g === 'year' ? 12 : g === 'week' ? 7 : 15;
        const allValues = data.flatMap((d) => [d.income, d.expense]).filter((v) => v > 0);
        const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
        const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
        const yMax = maxVal + maxVal * 0.15;
        const yMin = minVal > 0 ? Math.max(0, minVal - minVal * 0.05) : 0;
        this.lineChart = new Chart(this.lineCanvasRef.nativeElement, {
          type: 'line',
          data: {
            labels: data.map((d) => d.label),
            datasets: [
              {
                label: this.i18n.t('dashboard.ingresos'),
                data: data.map((d) => d.income),
                borderColor: positive,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 3,
                pointHoverBackgroundColor: positive,
                tension: 0.15,
                fill: false,
              },
              {
                label: this.i18n.t('dashboard.gastos'),
                data: data.map((d) => d.expense),
                borderColor: negative,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 3,
                pointHoverBackgroundColor: negative,
                tension: 0.15,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: this.cssVar('--bg-3') || 'oklch(90% 0 0)',
                titleColor: this.cssVar('--fg-0') || 'oklch(20% 0 0)',
                bodyColor: this.cssVar('--fg-1') || textColor,
                borderColor: this.cssVar('--line-1') || gridColor,
                borderWidth: 1,
                padding: 8,
                titleFont: { family: 'Geist', size: 11 },
                bodyFont: { family: 'Geist Mono', size: 11 },
                callbacks: {
                  label: (ctx: any) =>
                    `${ctx.dataset.label}: ${new Intl.NumberFormat('es').format(Math.round(ctx.parsed.y ?? 0))}`,
                },
              },
            },
            scales: {
              x: {
                ticks: { color: textColor, font: { family: 'Geist Mono', size: 10 }, maxTicksLimit, autoSkip: true },
                grid: { color: gridColor, drawTicks: false },
                border: { color: gridColor },
              },
              y: {
                min: yMin,
                suggestedMax: yMax,
                ticks: {
                  color: textColor,
                  font: { family: 'Geist Mono', size: 10 },
                  callback: (v: any) => new Intl.NumberFormat('es', { notation: 'compact' }).format(v as number),
                },
                grid: { color: gridColor, drawTicks: false },
                border: { color: gridColor },
              },
            },
          },
        });
      }

      if (this.pieCanvasRef) {
        this.pieChart?.destroy();
        this.pieChart = undefined;
        const cats = this.ds.categoryExpenses();
        if (cats.length > 0) {
          const fg0 = this.cssVar('--fg-0') || 'oklch(20% 0 0)';
          const fg1 = this.cssVar('--fg-1') || textColor;
          const bg1 = this.cssVar('--bg-1') || 'oklch(98% 0 0)';
          const bg3 = this.cssVar('--bg-3') || 'oklch(90% 0 0)';
          const line1 = this.cssVar('--line-1') || gridColor;
          const info = this.cssVar('--info') || accent2;
          const warning = this.cssVar('--warning') || accent3;
          const palette = [accent, accent2, accent3, info, positive, warning, negative];
          const colors = cats.map((_, i) => palette[i % palette.length]);
          const total = cats.reduce((s, c) => s + c.total, 0);
          const baseCcy = this.baseCurrency;

          this.pieChart = new Chart(this.pieCanvasRef.nativeElement, {
            type: 'doughnut',
            data: {
              labels: cats.map((c) => c.name),
              datasets: [
                {
                  data: cats.map((c) => c.total),
                  backgroundColor: colors,
                  borderColor: bg1,
                  borderWidth: 2,
                  hoverOffset: 8,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 600 },
              cutout: '68%',
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: fg1,
                    font: { family: 'Geist', size: 11 },
                    boxWidth: 10,
                    boxHeight: 10,
                    padding: 10,
                    usePointStyle: true,
                  },
                },
                tooltip: {
                  backgroundColor: bg3,
                  titleColor: fg0,
                  bodyColor: fg1,
                  borderColor: line1,
                  borderWidth: 1,
                  padding: 10,
                  titleFont: { family: 'Geist', size: 12 },
                  bodyFont: { family: 'Geist Mono', size: 11 },
                },
              },
            },
            plugins: [
              {
                id: 'centerText',
                afterDraw: (chart: Chart) => {
                  const { ctx, chartArea } = chart;
                  if (!chartArea) return;
                  const cx = (chartArea.left + chartArea.right) / 2,
                    cy = (chartArea.top + chartArea.bottom) / 2;
                  ctx.save();
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = fg1;
                  ctx.font = '500 10px "Geist Mono"';
                  ctx.fillText('TOTAL', cx, cy - 14);
                  ctx.fillStyle = fg0;
                  ctx.font = '600 18px "Geist Mono"';
                  ctx.fillText(new Intl.NumberFormat('es').format(Math.round(total)), cx, cy + 4);
                  ctx.fillStyle = fg1;
                  ctx.font = '400 9px "Geist Mono"';
                  ctx.fillText(baseCcy, cx, cy + 20);
                  ctx.restore();
                },
              },
            ],
          } as any);
        }
      }
    } catch (e) {
      console.error('[dashboard] chart render error', e);
    }
  }
}
