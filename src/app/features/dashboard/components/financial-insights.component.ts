import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, formatNumber } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinancialApiService } from '../../../shared/services/api/financial-api.service';
import { DashboardService } from '../../../shared/services/dashboard.service';
import type {
  AccountingVerification,
  FinancialKpis,
  PortfolioAnalytics,
  PortfolioOverview,
} from '../../../shared/models/financial.model';
import {
  FinancialBarChartComponent,
  type FinancialBarDatum,
} from '../../../shared/ui/organisms/financial-bar-chart/financial-bar-chart.component';

type WidgetId = 'kpis' | 'risks' | 'composition' | 'investments' | 'reconciliation';
const DEFAULT_WIDGETS: WidgetId[] = ['kpis', 'risks', 'composition', 'investments', 'reconciliation'];

@Component({
  selector: 'app-financial-insights',
  standalone: true,
  imports: [CommonModule, FinancialBarChartComponent],
  templateUrl: './financial-insights.component.html',
  styleUrl: './financial-insights.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialInsightsComponent {
  private api = inject(FinancialApiService);
  private ds = inject(DashboardService);
  private router = inject(Router);
  loading = signal(false);
  error = signal<string | null>(null);
  kpis = signal<FinancialKpis | null>(null);
  portfolio = signal<PortfolioAnalytics | null>(null);
  overview = signal<PortfolioOverview | null>(null);
  reconciliation = signal<AccountingVerification | null>(null);
  widgets = signal<WidgetId[]>(this.restoreWidgets());
  formulasOpen = signal(false);
  customizeOpen = signal(false);
  private requestedPeriod = '';

  constructor() {
    effect(() => {
      const key = this.ds.currentLabelKey().slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key) && key !== this.requestedPeriod) {
        this.requestedPeriod = key;
        this.load(key);
      }
    });
  }

  isVisible(id: WidgetId) {
    return this.widgets().includes(id);
  }
  money = (value: number, currency = '') =>
    `${formatNumber(Number.isFinite(value) ? value : 0, 'es-CO', '1.0-2')}${currency ? ` ${currency}` : ''}`;
  percent = (value: number | null) =>
    value == null || !Number.isFinite(value) ? '[sin datos]' : `${formatNumber(value, 'es-CO', '1.0-2')} %`;
  maxComposition = computed(() => Math.max(1, ...(this.portfolio()?.composition.map((x) => x.valueBase) ?? [1])));
  maxEvolution = computed(() =>
    Math.max(1, ...(this.portfolio()?.evolution.flatMap((x) => [x.assets, x.liabilities]) ?? [1])),
  );
  debtBars = computed<FinancialBarDatum[]>(() =>
    (this.overview()?.items ?? [])
      .filter((x) => x.kind === 'Liability' && x.valueBase !== null)
      .map((x) => ({ key: x.id, label: x.name, value: x.valueBase!, detail: x.type, color: 'var(--negative)' })),
  );
  cardBars = computed<FinancialBarDatum[]>(() => this.debtBars().filter((x) => x.detail === 'CreditCard'));
  liquidityBars = computed<FinancialBarDatum[]>(() =>
    (this.overview()?.items ?? [])
      .filter((x) => x.kind === 'Asset' && ['Cash', 'BankAccount'].includes(x.type) && x.valueBase !== null)
      .map((x) => ({ key: x.id, label: x.name, value: x.valueBase!, detail: x.type, color: 'var(--positive)' })),
  );

  load(period = this.requestedPeriod) {
    if (!period) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      kpis: this.api.getKpis(period),
      portfolio: this.api.getPortfolioAnalytics(),
      overview: this.api.getPortfolio(),
      reconciliation: this.api.getReconciliation(),
    }).subscribe({
      next: (result) => {
        this.kpis.set(result.kpis);
        this.portfolio.set(result.portfolio);
        this.overview.set(result.overview);
        this.reconciliation.set(result.reconciliation);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo calcular la analítica desde los datos locales.');
        this.loading.set(false);
      },
    });
  }

  toggle(id: WidgetId) {
    this.widgets.update((items) => (items.includes(id) ? items.filter((x) => x !== id) : [...items, id]));
    try {
      localStorage.setItem('dashboard.financial.widgets.v1', JSON.stringify(this.widgets()));
    } catch {

    }
  }

  move(id: WidgetId, offset: -1 | 1) {
    this.widgets.update((items) => {
      const from = items.indexOf(id),
        to = from + offset;
      if (from < 0 || to < 0 || to >= items.length) return items;
      const next = [...items];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    try {
      localStorage.setItem('dashboard.financial.widgets.v1', JSON.stringify(this.widgets()));
    } catch {

    }
  }
  widgetOrder(id: WidgetId) {
    const index = this.widgets().indexOf(id);
    return index < 0 ? 99 : 10 + index;
  }

  drill(type?: 'Income' | 'Expense', categoryId?: string | null) {
    const [year, month] = this.requestedPeriod.split('-');
    this.router.navigate(['/movements'], {
      queryParams: { year, month, type: type ?? null, categoryId: categoryId ?? null },
    });
  }

  drillEntity(item: FinancialBarDatum | { entityId: string }) {
    const [year, month] = this.requestedPeriod.split('-');
    const id = 'key' in item ? item.key : item.entityId;
    this.router.navigate(['/movements'], { queryParams: { year, month, portfolioEntityId: id } });
  }
  drillPortfolioType(type: string) {
    const [year, month] = this.requestedPeriod.split('-');
    this.router.navigate(['/movements'], { queryParams: { year, month, portfolioType: type } });
  }
  drillEvolution(date: string) {
    const [year, month] = date.slice(0, 7).split('-');
    this.router.navigate(['/movements'], { queryParams: { year, month } });
  }

  trackComposition = (_: number, item: { type: string }) => item.type;
  trackInvestment = (_: number, item: { entityId: string }) => item.entityId;

  private restoreWidgets(): WidgetId[] {
    try {
      const parsed = JSON.parse(localStorage.getItem('dashboard.financial.widgets.v1') ?? 'null');
      if (Array.isArray(parsed)) return DEFAULT_WIDGETS.filter((x) => parsed.includes(x));
    } catch {

    }
    return [...DEFAULT_WIDGETS];
  }
}
