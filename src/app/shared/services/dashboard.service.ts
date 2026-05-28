import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MovementsApiService } from './api/movements-api.service';
import { CategoriesApiService } from './api/categories-api.service';
import type { MovementResponse } from '../models/movement.model';
import type { CategoryResponse } from '../models/category.model';
import { I18nService } from '../i18n/i18n.service';
import { getMonthKey, getWeekRange, parseDate, toDateKey, toMonthKey } from '../utils/date';

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type TypeFilter = 'all' | 'Income' | 'Expense';

export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private movementsApi = inject(MovementsApiService);
  private categoriesApi = inject(CategoriesApiService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => {
      // cleanup handled by takeUntilDestroyed
    });
  }

  private lang = computed(() => {
    const loc = this.i18n.currentLocale();
    return loc === 'en-US' ? 'en' : loc === 'pt-BR' ? 'pt' : 'es';
  });

  readonly granularity = signal<Granularity>('month');
  readonly offset = signal(0);
  readonly typeFilter = signal<TypeFilter>('all');
  readonly categoryFilterId = signal('');
  readonly loading = signal(true);

  readonly categories = signal<CategoryResponse[]>([]);

  readonly lineData = signal<DataPoint[]>([]);
  readonly categoryExpenses = signal<{ name: string; total: number; icon: string; color: string }[]>([]);
  readonly recentMovements = signal<MovementResponse[]>([]);
  readonly totalIncome = signal(0);
  readonly totalExpense = signal(0);
  readonly topLabel = signal('');
  readonly topAmount = signal(0);
  readonly transactionCount = signal(0);

  readonly currentLabel = computed(() => {
    const now = new Date();
    const off = this.offset();
    const g = this.granularity();
    const lang = this.lang();
    if (g === 'year') {
      const y = now.getFullYear() + off;
      return new Intl.DateTimeFormat(lang, { year: 'numeric' }).format(new Date(y, 0, 1));
    }
    if (g === 'day') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (g === 'week') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const range = getWeekRange(d, lang);
      return range.label;
    }
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    return d.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  });

  readonly currentLabelKey = computed(() => {
    const now = new Date();
    const off = this.offset();
    const g = this.granularity();
    if (g === 'year') return `${now.getFullYear() + off}-01-01`;
    if (g === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (g === 'week' ? off * 7 : off));
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  });

  jumpTo(target: string) {
    const g = this.granularity();
    const [ty, tm, td] = target.split('-').map(Number);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (g === 'year') {
      this.offset.set(ty - now.getFullYear());
    } else if (g === 'month') {
      const cm = now.getFullYear() * 12 + now.getMonth();
      const tm2 = ty * 12 + tm - 1;
      this.offset.set(tm2 - cm);
    } else if (g === 'day') {
      const tgt = new Date(ty, tm - 1, td);
      const diff = tgt.getTime() - now.getTime();
      this.offset.set(Math.round(diff / 86400000));
    } else {
      const targetDate = new Date(ty, tm - 1, td);
      const day = targetDate.getDay();
      const diff2 = targetDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(targetDate.getFullYear(), targetDate.getMonth(), diff2);
      const nowDay = now.getDay();
      const nowDiff = now.getDate() - nowDay + (nowDay === 0 ? -6 : 1);
      const nowMonday = new Date(now.getFullYear(), now.getMonth(), nowDiff);
      const weekDiff = monday.getTime() - nowMonday.getTime();
      this.offset.set(Math.round(weekDiff / (86400000 * 7)));
    }
    this.load();
  }

  private cache: MovementResponse[] = [];

  prev() {
    this.offset.update((n) => n - 1);
    this.load();
  }

  next() {
    this.offset.update((n) => n + 1);
    this.load();
  }

  setOffset(n: number) {
    this.offset.set(n);
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

  setCategoryFilterId(id: string) {
    this.categoryFilterId.set(id);
    this.recompute();
  }

  load() {
    this.loading.set(true);
    this.cache = [];
    this.categoriesApi
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.categories.set(list),
        error: () => {},
      });
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
    of(yms)
      .pipe(
        switchMap((ymList) =>
          forkJoin(
            ymList.map((ym) =>
              this.movementsApi.getMovements(ym, 1, 100).pipe(
                catchError((err) => {
                  console.error(`[dashboard] error fetching ${ym}:`, err);
                  return of({ items: [], total: 0, page: 1, pageSize: 0 });
                }),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
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

    let periodData: MovementResponse[];
    if (g === 'year') {
      const year = now.getFullYear() + off;
      periodData = this.cache.filter((m) => parseDate(m.date).getFullYear() === year);
    } else if (g === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const y = d.getFullYear(),
        mo = d.getMonth();
      periodData = this.cache.filter((m) => {
        const md = parseDate(m.date);
        return md.getFullYear() === y && md.getMonth() === mo;
      });
    } else if (g === 'week') {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const range = getWeekRange(base);
      periodData = this.cache.filter((m) => {
        const md = parseDate(m.date);
        return md >= range.start && md <= range.end;
      });
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      const dayStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
      periodData = this.cache.filter((m) => toDateKey(parseDate(m.date)) === dayStr);
    }

    const cfi = this.categoryFilterId();
    if (cfi) periodData = periodData.filter((m) => m.categoryId === cfi);

    const tf = this.typeFilter();
    if (tf !== 'all') periodData = periodData.filter((m) => m.type === tf);

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

    this.categoryExpenses.set(this.buildCategoryMap(periodData));

    this.recentMovements.set(
      periodData.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()).slice(0, 8),
    );
    this.transactionCount.set(periodData.length);
  }

  private aggregateByHour(movements: MovementResponse[]): DataPoint[] {
    const slots = new Map<number, { income: number; expense: number }>();
    for (let h = 0; h < 24; h++) slots.set(h, { income: 0, expense: 0 });

    for (const m of movements) {
      const dt = parseDate(m.createdAt ?? m.date);
      const hour = dt.getHours();
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
    const g = this.granularity();
    const off = this.offset();
    const now = new Date();
    const lang = this.lang();

    if (g === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const map = new Map<number, { income: number; expense: number }>();
      for (let i = 1; i <= daysInMonth; i++) map.set(i, { income: 0, expense: 0 });

      for (const m of movements) {
        const md = parseDate(m.date);
        const day = md.getDate();
        const e = map.get(day);
        if (e) {
          if (m.type === 'Income') e.income += m.amountBase;
          else e.expense += m.amountBase;
        }
      }

      return [...map.entries()].map(([day, v]) => ({ label: String(day), income: v.income, expense: v.expense }));
    }

    if (g === 'week') {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const range = getWeekRange(base);
      const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en' : lang === 'pt' ? 'pt' : 'es', {
        weekday: 'short',
        day: 'numeric',
      });
      const map = new Map<string, { income: number; expense: number; sortKey: number }>();
      let idx = 0;
      const tmp = new Date(range.start);
      while (tmp <= range.end) {
        const key = toDateStr(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
        map.set(key, { income: 0, expense: 0, sortKey: idx++ });
        tmp.setDate(tmp.getDate() + 1);
      }

      for (const m of movements) {
        const key = toDateKey(parseDate(m.date));
        const e = map.get(key);
        if (e) {
          if (m.type === 'Income') e.income += m.amountBase;
          else e.expense += m.amountBase;
        }
      }

      return [...map.entries()]
        .sort((a, b) => a[1].sortKey - b[1].sortKey)
        .map(([key, v]) => {
          const d = parseDate(key);
          return { label: fmt.format(d), income: v.income, expense: v.expense };
        });
    }

    const dateFmt = new Intl.DateTimeFormat(lang === 'en' ? 'en' : lang === 'pt' ? 'pt' : 'es', {
      day: 'numeric',
      month: 'short',
    });
    const dayMap = new Map<string, { income: number; expense: number }>();
    for (const m of movements) {
      const day = toDateKey(parseDate(m.date));
      const e = dayMap.get(day) ?? { income: 0, expense: 0 };
      if (m.type === 'Income') e.income += m.amountBase;
      else e.expense += m.amountBase;
      dayMap.set(day, e);
    }
    return [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => {
        const d = parseDate(key);
        return { label: dateFmt.format(d), income: v.income, expense: v.expense };
      });
  }

  private aggregateByMonth(movements: MovementResponse[]): DataPoint[] {
    const off = this.offset();
    const now = new Date();
    const year = now.getFullYear() + off;
    const lang = this.lang();
    const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en' : lang === 'pt' ? 'pt' : 'es', { month: 'short' });

    const map = new Map<string, { income: number; expense: number }>();
    for (let m = 0; m < 12; m++) {
      const mk = `${year}-${String(m + 1).padStart(2, '0')}`;
      map.set(mk, { income: 0, expense: 0 });
    }

    for (const m of movements) {
      const mk = toMonthKey(parseDate(m.date));
      const e = map.get(mk);
      if (e) {
        if (m.type === 'Income') e.income += m.amountBase;
        else e.expense += m.amountBase;
      }
    }

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mk, v]) => {
        const d = parseDate(mk + '-15');
        const s = fmt.format(d);
        return { label: s.charAt(0).toUpperCase() + s.slice(1).replace('.', ''), income: v.income, expense: v.expense };
      });
  }

  private buildCategoryMap(
    movements: MovementResponse[],
  ): { name: string; total: number; icon: string; color: string }[] {
    const catMap = new Map<string, { name: string; total: number; icon: string; color: string }>();
    for (const m of movements) {
      if (m.type !== 'Expense') continue;
      const key = m.categoryId ?? '__none__';
      const existing = catMap.get(key);
      if (existing) {
        existing.total += m.amountBase ?? 0;
      } else {
        catMap.set(key, {
          name: m.categoryName ?? this.i18n.t('dashboard.sin_categoria'),
          total: m.amountBase ?? 0,
          icon: m.categoryIcon ?? 'tag',
          color: m.categoryColor ?? '#6b7280',
        });
      }
    }
    return [...catMap.values()].sort((a, b) => b.total - a.total);
  }
}
