import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinancialApiService } from '../../../shared/services/api/financial-api.service';
import { DashboardService } from '../../../shared/services/dashboard.service';
import { I18nService } from '../../../shared/i18n/i18n.service';
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
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton/skeleton.component';

type WidgetId = 'kpis' | 'risks' | 'composition' | 'investments' | 'reconciliation';
const DEFAULT_WIDGETS: WidgetId[] = ['kpis', 'risks', 'composition', 'investments', 'reconciliation'];
const COPY = {
  'es-CO': {
    title: 'Analítica financiera verificable',
    subtitle: 'Cifras calculadas localmente desde SQLite, en moneda base.',
    formulas: 'Fórmulas',
    customize: 'Personalizar',
    refresh: 'Actualizar',
    visiblePanels: 'Paneles visibles',
    kpis: 'KPIs',
    risks: 'Deuda y liquidez',
    wealth: 'Patrimonio',
    investments: 'Inversiones',
    reconciliation: 'Conciliación',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    net: 'Neto',
    netFormula: 'Ingresos − gastos',
    savingsRate: 'Tasa de ahorro',
    savingsFormula: 'transferencias de ahorro ÷ ingresos × 100',
    burden: 'Carga financiera',
    burdenFormula: 'servicio mensual de deuda ÷ ingresos × 100',
    runwayFormula: 'liquidez ÷ gasto promedio mensual de los últimos 3 meses',
    wealthFormula: 'activos − pasivos',
    calculating: 'Calculando…',
    error: 'No se pudo calcular la analítica desde los datos locales.',
    periodKpis: 'KPIs del período',
    income: 'Ingresos',
    expenses: 'Gastos',
    savings: 'Ahorro',
    totalDebt: 'Deuda total',
    service: 'Servicio',
    alert35: 'Alerta sobre 35%',
    cardUse: 'Uso de tarjetas',
    cardsOf: 'tarjetas · el resto está en otra moneda',
    alert70: 'Alerta sobre 70%',
    months: 'meses',
    runwayShort: 'Liquidez ÷ gasto promedio',
    expenseCategories: 'Categorías que explican el gasto',
    expenseDistribution: 'Distribución accesible del gasto por categoría',
    wealthComposition: 'Patrimonio y composición',
    baseCurrency: 'Moneda base',
    assetComposition: 'Composición de activos por tipo',
    evolution: 'Evolución',
    evolutionAria: 'Evolución mensual de activos y pasivos',
    assets: 'Activos',
    liabilities: 'Pasivos',
    noData: '[sin datos]',
    value: 'Valor',
    nominalReturn: 'Rentabilidad nominal',
    realReturn: 'Rentabilidad real',
    concentration: 'Concentración',
    fees: 'Comisiones',
    missing: 'Faltan',
    riskTitle: 'Deuda, tarjetas y liquidez',
    riskSubtitle: 'Cada barra abre los movimientos exactos del período.',
    debtByEntity: 'Deuda por entidad',
    cards: 'Tarjetas',
    cardDebt: 'Deuda en tarjetas',
    liquidity: 'Liquidez',
    liquidityByAccount: 'Liquidez por cuenta',
    reconciled: 'Conciliación aprobada',
    differences: 'Diferencias contables',
    tolerance: 'Tolerancia',
    served: 'Servido',
    recalculated: 'Recalculado',
    difference: 'Diferencia',
  },
  'en-US': {
    title: 'Verifiable financial analytics',
    subtitle: 'Figures calculated locally from SQLite in the base currency.',
    formulas: 'Formulas',
    customize: 'Customize',
    refresh: 'Refresh',
    visiblePanels: 'Visible panels',
    kpis: 'KPIs',
    risks: 'Debt and liquidity',
    wealth: 'Net worth',
    investments: 'Investments',
    reconciliation: 'Reconciliation',
    moveUp: 'Move up',
    moveDown: 'Move down',
    net: 'Net',
    netFormula: 'Income − expenses',
    savingsRate: 'Savings rate',
    savingsFormula: 'savings transfers ÷ income × 100',
    burden: 'Financial burden',
    burdenFormula: 'monthly debt service ÷ income × 100',
    runwayFormula: 'liquidity ÷ average monthly expenses over the last 3 months',
    wealthFormula: 'assets − liabilities',
    calculating: 'Calculating…',
    error: 'Analytics could not be calculated from local data.',
    periodKpis: 'Period KPIs',
    income: 'Income',
    expenses: 'Expenses',
    savings: 'Savings',
    totalDebt: 'Total debt',
    service: 'Service',
    alert35: 'Alert above 35%',
    cardUse: 'Credit-card use',
    cardsOf: 'cards · the rest use another currency',
    alert70: 'Alert above 70%',
    months: 'months',
    runwayShort: 'Liquidity ÷ average expenses',
    expenseCategories: 'Categories driving expenses',
    expenseDistribution: 'Accessible expense distribution by category',
    wealthComposition: 'Net worth and composition',
    baseCurrency: 'Base currency',
    assetComposition: 'Asset composition by type',
    evolution: 'Evolution',
    evolutionAria: 'Monthly evolution of assets and liabilities',
    assets: 'Assets',
    liabilities: 'Liabilities',
    noData: '[no data]',
    value: 'Value',
    nominalReturn: 'Nominal return',
    realReturn: 'Real return',
    concentration: 'Concentration',
    fees: 'Fees',
    missing: 'Missing',
    riskTitle: 'Debt, cards, and liquidity',
    riskSubtitle: 'Each bar opens the exact movements for the period.',
    debtByEntity: 'Debt by entity',
    cards: 'Cards',
    cardDebt: 'Credit-card debt',
    liquidity: 'Liquidity',
    liquidityByAccount: 'Liquidity by account',
    reconciled: 'Reconciliation passed',
    differences: 'Accounting differences',
    tolerance: 'Tolerance',
    served: 'Reported',
    recalculated: 'Recalculated',
    difference: 'Difference',
  },
  'pt-BR': {
    title: 'Análise financeira verificável',
    subtitle: 'Valores calculados localmente no SQLite, na moeda base.',
    formulas: 'Fórmulas',
    customize: 'Personalizar',
    refresh: 'Atualizar',
    visiblePanels: 'Painéis visíveis',
    kpis: 'KPIs',
    risks: 'Dívida e liquidez',
    wealth: 'Patrimônio',
    investments: 'Investimentos',
    reconciliation: 'Conciliação',
    moveUp: 'Subir',
    moveDown: 'Descer',
    net: 'Líquido',
    netFormula: 'Receitas − despesas',
    savingsRate: 'Taxa de poupança',
    savingsFormula: 'transferências de poupança ÷ receitas × 100',
    burden: 'Carga financeira',
    burdenFormula: 'serviço mensal da dívida ÷ receitas × 100',
    runwayFormula: 'liquidez ÷ despesa média mensal dos últimos 3 meses',
    wealthFormula: 'ativos − passivos',
    calculating: 'Calculando…',
    error: 'Não foi possível calcular a análise usando os dados locais.',
    periodKpis: 'KPIs do período',
    income: 'Receitas',
    expenses: 'Despesas',
    savings: 'Poupança',
    totalDebt: 'Dívida total',
    service: 'Serviço',
    alert35: 'Alerta acima de 35%',
    cardUse: 'Uso dos cartões',
    cardsOf: 'cartões · os demais usam outra moeda',
    alert70: 'Alerta acima de 70%',
    months: 'meses',
    runwayShort: 'Liquidez ÷ despesa média',
    expenseCategories: 'Categorias que explicam as despesas',
    expenseDistribution: 'Distribuição acessível das despesas por categoria',
    wealthComposition: 'Patrimônio e composição',
    baseCurrency: 'Moeda base',
    assetComposition: 'Composição dos ativos por tipo',
    evolution: 'Evolução',
    evolutionAria: 'Evolução mensal de ativos e passivos',
    assets: 'Ativos',
    liabilities: 'Passivos',
    noData: '[sem dados]',
    value: 'Valor',
    nominalReturn: 'Rentabilidade nominal',
    realReturn: 'Rentabilidade real',
    concentration: 'Concentração',
    fees: 'Comissões',
    missing: 'Faltam',
    riskTitle: 'Dívida, cartões e liquidez',
    riskSubtitle: 'Cada barra abre os movimentos exatos do período.',
    debtByEntity: 'Dívida por entidade',
    cards: 'Cartões',
    cardDebt: 'Dívida nos cartões',
    liquidity: 'Liquidez',
    liquidityByAccount: 'Liquidez por conta',
    reconciled: 'Conciliação aprovada',
    differences: 'Diferenças contábeis',
    tolerance: 'Tolerância',
    served: 'Informado',
    recalculated: 'Recalculado',
    difference: 'Diferença',
  },
} as const;

@Component({
  selector: 'app-financial-insights',
  standalone: true,
  imports: [CommonModule, FinancialBarChartComponent, SkeletonComponent],
  templateUrl: './financial-insights.component.html',
  styleUrl: './financial-insights.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialInsightsComponent {
  private api = inject(FinancialApiService);
  private ds = inject(DashboardService);
  private router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly copy = computed(() => COPY[this.i18n.currentLocale()]);
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
  private readonly nf = computed(
    () => new Intl.NumberFormat(this.i18n.currentLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  );
  money = (value: number, currency = '') =>
    `${this.nf().format(Number.isFinite(value) ? value : 0)}${currency ? ` ${currency}` : ''}`;
  percent = (value: number | null) =>
    value == null || !Number.isFinite(value) ? this.copy().noData : `${this.nf().format(value)} %`;
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
        this.error.set(this.copy().error);
        this.loading.set(false);
      },
    });
  }

  toggle(id: WidgetId) {
    this.widgets.update((items) => (items.includes(id) ? items.filter((x) => x !== id) : [...items, id]));
    try {
      localStorage.setItem('dashboard.financial.widgets.v1', JSON.stringify(this.widgets()));
    } catch {}
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
    } catch {}
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
    } catch {}
    return [...DEFAULT_WIDGETS];
  }
}
