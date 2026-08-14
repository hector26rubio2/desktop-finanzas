import {
  Component,
  OnInit,
  inject,
  computed,
  signal,
  ChangeDetectionStrategy,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { CommonModule, formatNumber } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { CategoryTranslations } from '../../shared/models/category.model';
import { AuthService } from '../../shared/services/auth/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { DashboardService, type Granularity } from '../../shared/services/dashboard.service';
import { sourceLabel } from '../../shared/utils/movement-labels';
import { formatDateTime } from '../../shared/utils/date';
import type { MovementResponse } from '../../shared/models/movement.model';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { LineChartComponent } from '@ui/organisms/line-chart/line-chart.component';
import { PieChartComponent } from '@ui/organisms/pie-chart/pie-chart.component';
import { FinancialInsightsComponent } from './components/financial-insights.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    KpiStripComponent,
    LineChartComponent,
    PieChartComponent,
    FinancialInsightsComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  public ds = inject(DashboardService);

  baseCurrency = this.auth.baseCurrency;

  kpiItems = computed<KpiStripItem[]>(() => {
    const fmt = (v: number) => formatNumber(v, 'en-US', '1.0-0');
    const items: KpiStripItem[] = [
      {
        label: this.i18n.t('dashboard.net_worth'),
        value: `${fmt(this.ds.netWorth())} ${this.baseCurrency()}`,
        color: this.ds.netWorth() >= 0 ? 'var(--positive)' : 'var(--negative)',
      },
      {
        label: this.i18n.t('dashboard.balance_periodo'),
        value: `${fmt(this.ds.totalIncome() - this.ds.totalExpense())} ${this.baseCurrency()}`,
        color: 'var(--accent)',
      },
      {
        label: `${this.i18n.t('dashboard.ingresos')} · ${this.ds.currentLabel()}`,
        value: `${fmt(this.ds.totalIncome())} ${this.baseCurrency()}`,
        color: 'var(--positive)',
      },
      {
        label: `${this.i18n.t('dashboard.gastos')} · ${this.ds.currentLabel()}`,
        value: `${fmt(this.ds.totalExpense())} ${this.baseCurrency()}`,
        color: 'var(--negative)',
      },
      { label: this.i18n.t('dashboard.transacciones'), value: `${this.ds.transactionCount()}` },
    ];
    if (this.ds.topLabel()) {
      items.push({
        label: this.i18n.t(this.topLabelKey()),
        value: `${this.ds.topLabel()} (${fmt(this.ds.topAmount())} ${this.baseCurrency()})`,
      });
    }
    return items;
  });

  recentDateCell = viewChild<TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>>('recentDateCell');
  recentTypeCell = viewChild<TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>>('recentTypeCell');
  recentSourceCell = viewChild<TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>>('recentSourceCell');
  recentAmountCell = viewChild<TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>>('recentAmountCell');

  trackById = (m: MovementResponse) => m.id;

  recentCols = computed<ColumnDef<MovementResponse>[]>(() => [
    { key: 'date', header: this.i18n.t('dashboard.fecha'), cellTpl: this.recentDateCell() },
    { key: 'description', header: this.i18n.t('dashboard.concepto'), format: (v) => (v as string | null) ?? '—' },
    { key: 'type', header: this.i18n.t('dashboard.tipo'), cellTpl: this.recentTypeCell() },
    { key: 'sourceType', header: this.i18n.t('transactions.source'), cellTpl: this.recentSourceCell() },
    { key: 'amount', header: this.i18n.t('dashboard.monto'), numeric: true, cellTpl: this.recentAmountCell() },
  ]);

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
    return g === 'year' ? 'dashboard.mes_mas_gasto' : 'dashboard.dia_mas_gasto';
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

  ngOnInit() {
    this.ds.load();
  }

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

  fmtDateTime(dateStr: string): string {
    const loc = this.i18n.currentLocale();
    return formatDateTime(dateStr, loc === 'pt-BR' ? 'pt-BR' : loc === 'en-US' ? 'en-US' : 'es-AR');
  }

  catName(cat: { name: string; translations: CategoryTranslations | null }): string {
    return this.i18n.catName(cat.name, cat.translations);
  }

  lineChartData = computed(() => this.ds.lineData());
  lineChartMaxTicks = computed(() => {
    const g = this.ds.granularity();
    return g === 'day' ? 12 : g === 'year' ? 12 : g === 'week' ? 7 : 15;
  });
  lineChartYRange = computed(() => {
    const data = this.ds.lineData();
    const allValues = data.flatMap((d) => [d.income, d.expense]).filter((v) => v > 0);
    if (!allValues.length) return { yMin: undefined, yMax: undefined };
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    return {
      yMin: minVal > 0 ? Math.max(0, minVal - minVal * 0.05) : 0,
      yMax: maxVal + maxVal * 0.15,
    };
  });
}
