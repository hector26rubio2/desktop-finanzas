import { Injectable, signal, computed, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService, MovementResponse } from './api.service';

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type TypeFilter = 'all' | 'Income' | 'Expense';

export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getWeekRange(date: Date): { start: Date; end: Date; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (dt: Date) => dt.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return { start: monday, end: sunday, label: `${fmt(monday)} – ${fmt(sunday)}` };
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  readonly granularity = signal<Granularity>('month');
  readonly offset = signal(0);
  readonly typeFilter = signal<TypeFilter>('all');
  readonly currencyFilter = signal('');
  readonly loading = signal(true);

  readonly lineData = signal<DataPoint[]>([]);
  readonly categoryExpenses = signal<{ name: string; total: number }[]>([]);
  readonly recentMovements = signal<MovementResponse[]>([]);
  readonly totalIncome = signal(0);
  readonly totalExpense = signal(0);
  readonly topLabel = signal('');
  readonly topAmount = signal(0);

  readonly availableCurrencies = computed(() => {
    const ccs = new Set<string>();
    for (const m of this.cache) {
      if (m.currency) ccs.add(m.currency);
    }
    return [...ccs].sort();
  });

  readonly currentLabel = computed(() => {
    const now = new Date();
    const off = this.offset();
    const g = this.granularity();
    if (g === 'year') {
      return `Año ${now.getFullYear() + off}`;
    }
    if (g === 'day') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (g === 'week') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      return getWeekRange(d).label;
    }
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  });

  private cache: MovementResponse[] = [];

  prev() {
    this.offset.update((n) => n - 1);
    this.load();
  }

  next() {
    this.offset.update((n) => n + 1);
    this.load();
  }

  setGranularity(g: Granularity) {
    if (this.granularity() === g) return;
    this.granularity.set(g);
    this.offset.set(0);
    this.load();
  }

  setTypeFilter(t: TypeFilter) {
    this.typeFilter.set(t);
    this.recompute();
  }

  setCurrencyFilter(ccy: string) {
    this.currencyFilter.set(ccy);
    this.recompute();
  }

  load() {
    this.loading.set(true);
    this.cache = [];
    const g = this.granularity();
    const off = this.offset();
    const now = new Date();

    if (g === 'year') {
      const year = now.getFullYear() + off;
      const yms: string[] = [];
      for (let m = 0; m < 12; m++) yms.push(getMonthKey(year, m));
      this.fetchAll(yms);
    } else if (g === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      this.fetchAll([getMonthKey(d.getFullYear(), d.getMonth())]);
    } else if (g === 'week') {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const range = getWeekRange(base);
      const months = new Set<string>();
      const tmp = new Date(range.start);
      while (tmp <= range.end) {
        months.add(getMonthKey(tmp.getFullYear(), tmp.getMonth()));
        tmp.setDate(tmp.getDate() + 1);
      }
      this.fetchAll([...months]);
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      this.fetchAll([getMonthKey(d.getFullYear(), d.getMonth())]);
    }
  }

  private fetchAll(yms: string[]) {
    forkJoin(
      yms.map((ym) =>
        this.api.getMovements(ym, 1, 1000).pipe(
          catchError((err) => {
            console.error(`[dashboard] error fetching ${ym}:`, err);
            return of({ items: [], total: 0, page: 1, pageSize: 0 });
          }),
        ),
      ),
    ).subscribe({
      next: (pages) => {
        this.cache = pages.flatMap((p) => p.items ?? []);
        this.recompute();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[dashboard] fetchAll failed:', err);
        this.loading.set(false);
      },
    });
  }

  private recompute() {
    const now = new Date();
    const off = this.offset();
    const g = this.granularity();

    // ── Period filter (ALL data — type/currency filters NOT applied here) ──
    let periodData: MovementResponse[];
    if (g === 'year') {
      const year = now.getFullYear() + off;
      periodData = this.cache.filter((m) => new Date(m.date).getFullYear() === year);
    } else if (g === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      periodData = this.cache.filter((m) => {
        const md = new Date(m.date);
        return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
      });
    } else if (g === 'week') {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const range = getWeekRange(base);
      periodData = this.cache.filter((m) => {
        const md = new Date(m.date);
        return md >= range.start && md <= range.end;
      });
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      const dayStr = d.toISOString().slice(0, 10);
      periodData = this.cache.filter((m) => m.date.slice(0, 10) === dayStr);
    }

    // ── Line chart + KPI (from period data, no type/currency filter) ──
    let lineData: DataPoint[];
    if (g === 'year') {
      lineData = this.aggregateByMonth(periodData);
    } else if (g === 'day') {
      lineData = this.aggregateByHour(periodData);
    } else {
      lineData = this.aggregateByDay(periodData);
    }

    this.lineData.set(lineData);
    this.totalIncome.set(lineData.reduce((a, d) => a + d.income, 0));
    this.totalExpense.set(lineData.reduce((a, d) => a + d.expense, 0));
    const top = lineData.reduce((a, b) => (b.expense > a.expense ? b : a), lineData[0]);
    this.topLabel.set(top?.label ?? '');
    this.topAmount.set(top?.expense ?? 0);

    // ── Category expenses (typeFilter + currencyFilter apply ONLY here) ──
    let catData = this.cache;
    const t = this.typeFilter();
    if (t !== 'all') catData = catData.filter((m) => m.type === t);
    const ccy = this.currencyFilter();
    if (ccy) catData = catData.filter((m) => m.currency === ccy);
    this.categoryExpenses.set(this.buildCategoryMap(catData));

    // ── Recent movements (from period data) ──
    this.recentMovements.set(periodData.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8));
  }

  private aggregateByHour(movements: MovementResponse[]): DataPoint[] {
    const slots = new Map<number, { income: number; expense: number }>();
    for (let h = 0; h < 24; h++) slots.set(h, { income: 0, expense: 0 });

    for (const m of movements) {
      const hour = new Date(m.createdAt).getHours();
      const e = slots.get(hour)!;
      if (m.type === 'Income') e.income += m.amountBase;
      else e.expense += m.amountBase;
    }

    return [...slots.entries()].map(([hour, v]) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      income: v.income,
      expense: v.expense,
    }));
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
