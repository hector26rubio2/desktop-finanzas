import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatNumber } from '@angular/common';
import { ApiService, MovementResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { PieChartComponent, CategoryExpense } from '@ui/organisms/pie-chart/pie-chart.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { forkJoin } from 'rxjs';
import { FinancialApiService } from '../../shared/services/api/financial-api.service';
import { AuthService } from '../../shared/services/auth/auth.service';

interface MonthStat {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

interface CashflowRow extends MonthStat {
  neto: number;
  /** Valor para la columna barra (clave única requerida por data-table) */
  bar: number;
}

interface MomRow extends MonthStat {
  incomeDelta: number | null;
  expenseDelta: number | null;
}

interface CatStat extends CategoryExpense {
  pct: number;
  count: number;
}

type Tpl<T> = TemplateRef<{ $implicit: T; row: T }>;

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PieChartComponent, KpiStripComponent, DataTableComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent implements OnInit {
  tab = signal<'overview' | 'cat' | 'mom'>('overview');
  loading = signal(true);
  error = signal(false);
  monthStats = signal<MonthStat[]>([]);
  income12 = signal(0);
  expense12 = signal(0);
  savings12 = signal(0);
  maxExpense = signal(0);

  catLoading = signal(true);
  catMovements = signal<MovementResponse[]>([]);
  commitments = signal(0);

  private api = inject(ApiService);
  private financialApi = inject(FinancialApiService);
  public i18n = inject(I18nService);
  public auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  avgMonthlyExpense = computed(() => {
    const stats = this.monthStats().filter((s) => s.expense > 0);
    if (stats.length === 0) return 0;
    return this.expense12() / stats.length;
  });

  catStats = computed<CatStat[]>(() => {
    const byCat = new Map<string, CatStat>();
    let total = 0;
    for (const m of this.catMovements()) {
      if (m.type !== 'Expense') continue;
      const key = m.categoryName ?? '—';
      const cur = byCat.get(key) ?? { name: key, total: 0, pct: 0, count: 0, color: m.categoryColor ?? undefined };
      cur.total += m.amountBase;
      cur.count += 1;
      byCat.set(key, cur);
      total += m.amountBase;
    }
    return [...byCat.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, pct: total > 0 ? (c.total / total) * 100 : 0 }));
  });

  topCategories = computed(() => this.catStats().slice(0, 3));

  kpiItems = computed<KpiStripItem[]>(() => {
    const fmt = (v: number) => formatNumber(v, 'en-US', '1.0-0');
    const neto = this.income12() - this.expense12();
    const rate = this.income12() > 0 ? formatNumber((this.savings12() / this.income12()) * 100, 'en-US', '1.1-1') : '0';
    const items: KpiStripItem[] = [
      { label: this.i18n.t('reports.ingresos_12m'), value: fmt(this.income12()), color: 'var(--positive)' },
      { label: this.i18n.t('reports.gastos_12m'), value: fmt(this.expense12()), color: 'var(--negative)' },
      {
        label: this.i18n.t('reports.ahorro_neto'),
        value: fmt(neto),
        color: neto >= 0 ? 'var(--positive)' : 'var(--negative)',
      },
      { label: this.i18n.t('reports.tasa_ahorro'), value: rate + '%' },
      { label: this.i18n.t('reports.gasto_promedio'), value: fmt(this.avgMonthlyExpense()) },
      { label: this.i18n.t('reports.compromisos'), value: fmt(this.commitments()), color: 'var(--warning)' },
    ];
    const top = this.topCategories()[0];
    if (top) {
      items.push({
        label: this.i18n.t('reports.top_categorias'),
        value: top.name,
        sub: formatNumber(top.pct, 'en-US', '1.0-0') + '%',
      });
    }
    return items;
  });

  cashflowRows = computed<CashflowRow[]>(() =>
    this.monthStats().map((s) => ({ ...s, neto: s.income - s.expense, bar: s.expense })),
  );

  momRows = computed<MomRow[]>(() =>
    this.monthStats().map((s, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : null;
      return {
        ...s,
        incomeDelta: prev ? ((s.income - prev.income) / (prev.income || 1)) * 100 : null,
        expenseDelta: prev ? ((s.expense - prev.expense) / (prev.expense || 1)) * 100 : null,
      };
    }),
  );

  cfMonthCell = viewChild<Tpl<CashflowRow>>('cfMonthCell');
  cfIncomeCell = viewChild<Tpl<CashflowRow>>('cfIncomeCell');
  cfExpenseCell = viewChild<Tpl<CashflowRow>>('cfExpenseCell');
  cfNetoCell = viewChild<Tpl<CashflowRow>>('cfNetoCell');
  cfBarCell = viewChild<Tpl<CashflowRow>>('cfBarCell');

  catTotalCell = viewChild<Tpl<CatStat>>('catTotalCell');
  catPctCell = viewChild<Tpl<CatStat>>('catPctCell');
  catBarCell = viewChild<Tpl<CatStat>>('catBarCell');

  momMonthCell = viewChild<Tpl<MomRow>>('momMonthCell');
  momIncomeCell = viewChild<Tpl<MomRow>>('momIncomeCell');
  momIncomeDeltaCell = viewChild<Tpl<MomRow>>('momIncomeDeltaCell');
  momExpenseCell = viewChild<Tpl<MomRow>>('momExpenseCell');
  momExpenseDeltaCell = viewChild<Tpl<MomRow>>('momExpenseDeltaCell');

  trackByMonth = (s: MonthStat) => s.month;
  trackByName = (c: CatStat) => c.name;

  cashflowCols = computed<ColumnDef<CashflowRow>[]>(() => [
    { key: 'month', header: this.i18n.t('reports.table_mes'), cellTpl: this.cfMonthCell() },
    { key: 'income', header: this.i18n.t('reports.table_ingresos'), numeric: true, cellTpl: this.cfIncomeCell() },
    { key: 'expense', header: this.i18n.t('reports.table_gastos'), numeric: true, cellTpl: this.cfExpenseCell() },
    { key: 'neto', header: this.i18n.t('reports.table_neto'), numeric: true, cellTpl: this.cfNetoCell() },
    { key: 'bar', header: this.i18n.t('reports.table_barra'), cellTpl: this.cfBarCell() },
  ]);

  catCols = computed<ColumnDef<CatStat>[]>(() => [
    { key: 'name', header: this.i18n.t('transactions.table_categoria') },
    { key: 'total', header: this.i18n.t('transactions.table_monto'), numeric: true, cellTpl: this.catTotalCell() },
    { key: 'pct', header: this.i18n.t('reports.col_porcentaje'), numeric: true, cellTpl: this.catPctCell() },
    { key: 'count', header: this.i18n.t('reports.table_barra'), cellTpl: this.catBarCell() },
  ]);

  momCols = computed<ColumnDef<MomRow>[]>(() => [
    { key: 'month', header: this.i18n.t('reports.table_mes'), cellTpl: this.momMonthCell() },
    { key: 'income', header: this.i18n.t('reports.table_ingresos'), numeric: true, cellTpl: this.momIncomeCell() },
    {
      key: 'incomeDelta',
      header: this.i18n.t('reports.table_vs_anterior'),
      numeric: true,
      cellTpl: this.momIncomeDeltaCell(),
    },
    { key: 'expense', header: this.i18n.t('reports.table_gastos'), numeric: true, cellTpl: this.momExpenseCell() },
    {
      key: 'expenseDelta',
      header: this.i18n.t('reports.table_vs_anterior'),
      numeric: true,
      cellTpl: this.momExpenseDeltaCell(),
    },
  ]);

  ngOnInit() {
    const now = new Date();
    const requests = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const currentYm = requests[requests.length - 1];

    forkJoin(requests.map((ym) => this.financialApi.getKpis(ym)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sums) => {
          const stats = sums.map((s, i) => ({
            month: requests[i],
            income: s.income,
            expense: s.expense,
            savings: s.savings,
          }));
          this.monthStats.set(stats);
          this.income12.set(stats.reduce((a, s) => a + s.income, 0));
          this.expense12.set(stats.reduce((a, s) => a + s.expense, 0));
          this.savings12.set(stats.reduce((a, s) => a + s.savings, 0));
          this.maxExpense.set(Math.max(...stats.map((s) => s.expense), 1));
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });

    this.api
      .getMovements(currentYm, 1, 500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.catMovements.set(r.items);
          this.catLoading.set(false);
        },
        error: () => this.catLoading.set(false),
      });

    forkJoin([this.api.getInstallments(), this.api.getLoans()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([insts, loans]) => {
        const instMonthly = insts
          .filter((i) => i.isActive && i.paidCount < i.installmentsCount)
          .reduce((s, i) => s + i.monthlyAmount * (i.trmApplied || 1), 0);
        const loanMonthly = loans
          .filter((l) => l.isActive && l.paidMonths < l.termMonths)
          .reduce((s, l) => {
            const im = Math.pow(1 + l.interestRateAnnual / 100, 1 / 12) - 1;
            const pmt =
              im === 0
                ? l.principal / l.termMonths
                : (l.principal * im * Math.pow(1 + im, l.termMonths)) / (Math.pow(1 + im, l.termMonths) - 1);
            return s + pmt * (l.trmApplied || 1);
          }, 0);
        this.commitments.set(instMonthly + loanMonthly);
      });
  }

  exportCsv() {
    const sep = ';';
    const head = ['mes', 'ingresos', 'gastos', 'neto'].join(sep);
    const rows = this.monthStats().map((s) => [s.month, s.income, s.expense, s.income - s.expense].join(sep));
    const blob = new Blob(['﻿' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-12m-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
