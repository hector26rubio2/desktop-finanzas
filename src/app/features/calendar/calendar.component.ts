import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  viewChild,
  TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatNumber } from '@angular/common';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { TranslationKey } from '../../shared/i18n/locale.types';
import { ApiService, MovementResponse, PagedResult } from '../../shared/services/api.service';
import { MovementDetailModalComponent } from '@ui/organisms/movement-detail-modal/movement-detail-modal.component';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';
import { parseDate } from '../../shared/utils/date';
import type { KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import type { ColumnDef } from '@ui/organisms/data-table/data-table.component';

interface CalEvent {
  movement: MovementResponse;
  day: number;
}

type MovTpl = TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>;

@Component({
  selector: 'app-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MovementDetailModalComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit {
  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  today = new Date();
  currentDate = signal(new Date());
  movements = signal<MovementResponse[]>([]);
  page = signal<PagedResult<MovementResponse> | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  selectedMovement = signal<MovementResponse | null>(null);
  loading = signal(true);

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

  totalPages = computed(() => {
    const p = this.page();
    if (!p) return 1;
    return Math.ceil(p.total / p.pageSize) || 1;
  });

  eventsThisMonth = computed<CalEvent[]>(() => {
    return this.movements()
      .filter((m) => m.type === 'Expense')
      .map((m) => {
        const d = parseDate(m.date);
        return { movement: m, day: d.getDate() };
      });
  });

  totalCommitted = computed(() => this.eventsThisMonth().reduce((s, e) => s + e.movement.amount, 0));

  kpiItems = computed<KpiStripItem[]>(() => [
    { label: this.i18n.t('calendar.pagos_mes'), value: '' + this.eventsThisMonth().length },
    {
      label: this.i18n.t('calendar.total_comprometido'),
      value: '$ ' + formatNumber(this.totalCommitted(), 'en-US', '1.0-0'),
      color: 'var(--negative)',
    },
    { label: this.i18n.t('calendar.proximo_pago'), value: this.nextEvent(), color: 'var(--accent)' },
  ]);

  nextEvent = computed(() => {
    // Solo tiene sentido "próximo pago" mirando desde hoy: meses pasados no tienen próximos
    const viewing = this.currentDate();
    const now = this.today;
    const viewingPast =
      viewing.getFullYear() < now.getFullYear() ||
      (viewing.getFullYear() === now.getFullYear() && viewing.getMonth() < now.getMonth());
    if (viewingPast) return '—';
    const isCurrent = this.isCurrentMonth();
    const upcoming = this.eventsThisMonth()
      .filter((e) => !isCurrent || e.day >= now.getDate())
      .sort((a, b) => a.day - b.day);
    if (upcoming.length === 0) return '—';
    const next = upcoming[0];
    return `${next.day} — ${next.movement.description ?? next.movement.categoryName ?? '—'}`;
  });

  calendarCells = computed(() => {
    const year = this.year();
    const month = this.month();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const eventsByDay = new Map<number, CalEvent[]>();
    for (const e of this.eventsThisMonth()) {
      const list = eventsByDay.get(e.day);
      if (list) list.push(e);
      else eventsByDay.set(e.day, [e]);
    }
    const cells: { day: number; events: CalEvent[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: 0, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, events: eventsByDay.get(d) ?? [] });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, events: [] });
    return cells;
  });

  pendingItems = computed(() => {
    const p = this.page();
    if (!p) return [];
    return p.items;
  });

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

  yearMonth() {
    const m = String(this.month() + 1).padStart(2, '0');
    return `${this.year()}-${m}`;
  }

  eventsForDay(day: number): CalEvent[] {
    return this.eventsThisMonth().filter((e) => e.day === day);
  }

  prevMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.loadData();
  }

  nextMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.loadData();
  }

  goToToday() {
    this.currentDate.set(new Date());
    this.loadData();
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api
      .getMovements(this.yearMonth(), 1, 200)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.movements.set(r.items);
          this.loading.set(false);
          this.loadTablePage(1);
        },
        error: () => this.loading.set(false),
      });
  }

  loadTablePage(p: number) {
    this.currentPage.set(p);
    this.api
      .getMovements(this.yearMonth(), p, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.page.set(r),
      });
  }

  onPageChange(p: number) {
    this.loadTablePage(p);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.loadTablePage(1);
  }

  openDetail(m: MovementResponse) {
    this.selectedMovement.set(m);
  }

  closeDetail() {
    this.selectedMovement.set(null);
  }

  kindFromMovement(m: MovementResponse): string {
    if (m.sourceType === 'CreditCard') return 'card';
    if (m.subType === 'LoanGiven' || m.subType === 'LoanReceived') return 'loan';
    return 'expense';
  }

  kindLabel(kind: string): string {
    if (kind === 'card') return this.i18n.t('calendar.tag_tarjeta');
    if (kind === 'loan') return this.i18n.t('calendar.tag_prestamo');
    return this.i18n.t('calendar.tag_cuota');
  }

  rowCount = computed(() => this.page()?.total ?? 0);

  dateCell = viewChild<MovTpl>('dateCell');
  conceptCell = viewChild<MovTpl>('conceptCell');
  categoryCell = viewChild<MovTpl>('categoryCell');
  sourceCell = viewChild<MovTpl>('sourceCell');
  typeCell = viewChild<MovTpl>('typeCell');
  amountCell = viewChild<MovTpl>('amountCell');

  trackById = (m: MovementResponse) => m.id;

  cols = computed<ColumnDef<MovementResponse>[]>(() => [
    { key: 'date', header: this.i18n.t('transactions.table_fecha'), width: '110px', cellTpl: this.dateCell() },
    { key: 'description', header: this.i18n.t('transactions.table_concepto'), cellTpl: this.conceptCell() },
    { key: 'categoryName', header: this.i18n.t('transactions.table_categoria'), cellTpl: this.categoryCell() },
    { key: 'sourceType', header: this.i18n.t('transactions.source'), cellTpl: this.sourceCell() },
    { key: 'type', header: this.i18n.t('transactions.table_tipo'), width: '70px', cellTpl: this.typeCell() },
    { key: 'amount', header: this.i18n.t('transactions.table_monto'), numeric: true, cellTpl: this.amountCell() },
  ]);
}
