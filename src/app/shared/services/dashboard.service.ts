import { Injectable, signal, computed, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ApiService, MovementResponse } from './api.service';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

function isoWeek(d: Date): string {
  const temp = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - dayNum + 3);
  const firstThursday = temp.valueOf();
  temp.setMonth(0, 1);
  if (temp.getDay() !== 4) {
    temp.setMonth(0, 1 + ((4 - temp.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - temp.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  private abortCtrl?: AbortController;

  readonly granularity = signal<Granularity>('month');
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly lineData = signal<DataPoint[]>([]);
  readonly categoryExpenses = signal<{ name: string; total: number }[]>([]);
  readonly recentMovements = signal<MovementResponse[]>([]);
  readonly totalIncome = signal(0);
  readonly totalExpense = signal(0);
  readonly topLabel = signal('');
  readonly topAmount = signal(0);

  readonly currentLabel = computed(() => {
    const g = this.granularity();
    const off = this.offset();
    const now = new Date();
    if (g === 'year') {
      const y = now.getFullYear() + off;
      return `Año ${y}`;
    }
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    if (g === 'week') return `Sem ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
    if (g === 'day') return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
    return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
  });

  private allMovementsCache = new Map<string, MovementResponse[]>();

  prev() {
    this.offset.update((n) => n - 1);
    this.load();
  }

  next() {
    this.offset.update((n) => n + 1);
    this.load();
  }

  load() {
    this.abortCtrl?.abort();
    this.loading.set(true);
    const g = this.granularity();
    if (g === 'month') this.loadMonthly();
    else if (g === 'year') this.loadYearly();
    else if (g === 'week') this.loadWeekly();
    else this.loadDaily();
  }

  setGranularity(g: Granularity) {
    if (this.granularity() === g) return;
    this.granularity.set(g);
    this.offset.set(0);
    this.load();
  }

  private baseDate(): Date {
    const now = new Date();
    const g = this.granularity();
    const off = this.offset();
    if (g === 'year') {
      return new Date(now.getFullYear() + off, 0, 1);
    }
    return new Date(now.getFullYear(), now.getMonth() + off, 1);
  }

  private fetchMovements(ym: string, pageSize = 500): Promise<MovementResponse[]> {
    const cached = this.allMovementsCache.get(ym);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      this.api
        .getMovements(ym, 1, pageSize)
        .pipe(
          tap((page) => {
            this.allMovementsCache.set(ym, page.items);
            resolve(page.items);
          }),
          catchError(() => {
            resolve([]);
            return of({ items: [], total: 0, page: 1, pageSize: 0 });
          }),
        )
        .subscribe();
    });
  }

  private aggregateByDay(movements: MovementResponse[]): DataPoint[] {
    const map = new Map<string, { income: number; expense: number }>();
    for (const m of movements) {
      const day = m.date.slice(0, 10);
      const e = map.get(day) ?? { income: 0, expense: 0 };
      if (m.type === 'Income') e.income += m.amountBase;
      else e.expense += m.amountBase;
      map.set(day, e);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private aggregateByWeek(movements: MovementResponse[]): DataPoint[] {
    const map = new Map<string, { income: number; expense: number }>();
    for (const m of movements) {
      const wk = isoWeek(new Date(m.date));
      const e = map.get(wk) ?? { income: 0, expense: 0 };
      if (m.type === 'Income') e.income += m.amountBase;
      else e.expense += m.amountBase;
      map.set(wk, e);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private aggregateByMonth(movements: MovementResponse[]): DataPoint[] {
    const map = new Map<string, { income: number; expense: number }>();
    for (const m of movements) {
      const mk = m.date.slice(0, 7);
      const e = map.get(mk) ?? { income: 0, expense: 0 };
      if (m.type === 'Income') e.income += m.amountBase;
      else e.expense += m.amountBase;
      map.set(mk, e);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private async loadDaily() {
    const base = this.baseDate();
    const ym = getMonthKey(base.getFullYear(), base.getMonth());
    const items = await this.fetchMovements(ym);
    const data = this.aggregateByDay(items);
    this.lineData.set(data);
    this.totalIncome.set(data.reduce((a, d) => a + d.income, 0));
    this.totalExpense.set(data.reduce((a, d) => a + d.expense, 0));
    const top = data.reduce((a, b) => (b.expense > a.expense ? b : a), data[0]);
    this.topLabel.set(top?.label ?? '');
    this.topAmount.set(top?.expense ?? 0);

    const catMap = this.buildCategoryMap(items);
    this.categoryExpenses.set(catMap);
    this.recentMovements.set(items.slice(0, 8));
    this.loading.set(false);
  }

  private async loadWeekly() {
    const base = this.baseDate();
    const yms: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      yms.push(getMonthKey(d.getFullYear(), d.getMonth()));
    }
    const all = (await Promise.all(yms.map((ym) => this.fetchMovements(ym)))).flat();
    const data = this.aggregateByWeek(all);
    this.lineData.set(data);
    this.totalIncome.set(data.reduce((a, d) => a + d.income, 0));
    this.totalExpense.set(data.reduce((a, d) => a + d.expense, 0));
    const top = data.reduce((a, b) => (b.expense > a.expense ? b : a), data[0]);
    this.topLabel.set(top?.label ?? '');
    this.topAmount.set(top?.expense ?? 0);

    const catMap = this.buildCategoryMap(all);
    this.categoryExpenses.set(catMap);
    this.recentMovements.set(all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8));
    this.loading.set(false);
  }

  private loadMonthly() {
    const base = this.baseDate();
    const requests: { ym: string; d: Date }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - (11 - i), 1);
      requests.push({ ym: getMonthKey(d.getFullYear(), d.getMonth()), d });
    }

    forkJoin(requests.map((r) => this.api.getMovementSummary(r.ym))).subscribe({
      next: (summaries) => {
        const stats: DataPoint[] = summaries.map((s, i) => ({
          label: requests[i].ym,
          income: s?.totalIncome ?? 0,
          expense: s?.totalExpense ?? 0,
        }));
        this.lineData.set(stats);
        this.totalIncome.set(stats.reduce((a, s) => a + s.income, 0));
        this.totalExpense.set(stats.reduce((a, s) => a + s.expense, 0));
        const top = stats.reduce((a, b) => (b.expense > a.expense ? b : a), stats[0]);
        this.topLabel.set(top?.label ?? '');
        this.topAmount.set(top?.expense ?? 0);

        this.loading.set(false);

        this.api.getMovements(requests[requests.length - 1].ym, 1, 200).subscribe({
          next: (page) => {
            this.recentMovements.set(page?.items?.slice(0, 8) ?? []);
            const catMap = this.buildCategoryMap(page?.items ?? []);
            this.categoryExpenses.set(catMap);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private loadYearly() {
    const base = this.baseDate();
    const requests: { ym: string; year: number }[] = [];
    for (let y = base.getFullYear() - 4; y <= base.getFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        requests.push({ ym: getMonthKey(y, m), year: y });
      }
    }

    forkJoin(requests.map((r) => this.api.getMovementSummary(r.ym).pipe(catchError(() => of(null))))).subscribe({
      next: (summaries) => {
        const yearMap = new Map<number, { income: number; expense: number }>();
        for (let i = 0; i < summaries.length; i++) {
          const s = summaries[i];
          if (!s) continue;
          const y = requests[i].year;
          const e = yearMap.get(y) ?? { income: 0, expense: 0 };
          e.income += s.totalIncome ?? 0;
          e.expense += s.totalExpense ?? 0;
          yearMap.set(y, e);
        }
        const data: DataPoint[] = [...yearMap.entries()]
          .map(([year, v]) => ({ label: String(year), income: v.income, expense: v.expense }))
          .sort((a, b) => a.label.localeCompare(b.label));

        this.lineData.set(data);
        this.totalIncome.set(data.reduce((a, d) => a + d.income, 0));
        this.totalExpense.set(data.reduce((a, d) => a + d.expense, 0));
        const top = data.reduce((a, b) => (b.expense > a.expense ? b : a), data[0]);
        this.topLabel.set(top?.label ?? '');
        this.topAmount.set(top?.expense ?? 0);

        this.loading.set(false);

        const lastYm = requests[requests.length - 1].ym;
        this.api.getMovements(lastYm, 1, 200).subscribe({
          next: (page) => {
            this.recentMovements.set(page?.items?.slice(0, 8) ?? []);
            const catMap = this.buildCategoryMap(page?.items ?? []);
            this.categoryExpenses.set(catMap);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private buildCategoryMap(movements: MovementResponse[]): { name: string; total: number }[] {
    const catMap = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'Expense') continue;
      const key = m.categoryName ?? 'Sin categoría';
      catMap.set(key, (catMap.get(key) ?? 0) + (m.amountBase ?? 0));
    }
    return [...catMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }
}
