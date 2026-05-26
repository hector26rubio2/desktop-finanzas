import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed,
  ChangeDetectionStrategy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { TranslationKey } from '../../shared/i18n/locale.types';
import { ApiService, MovementResponse, PagedResult } from '../../shared/services/api.service';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { CatIconComponent } from '../../shared/ui/cat-icon/cat-icon.component';
import { Subscription } from 'rxjs';

@Pipe({ standalone: true, name: 'calDate' })
export class CalDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  }
}

interface CalEvent {
  movement: MovementResponse;
  day: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, CatIconComponent, CalDatePipe],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit, OnDestroy {
  public i18n = inject(I18nService);
  private api = inject(ApiService);
  private sub = new Subscription();

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

  eventsThisMonth(): CalEvent[] {
    return this.movements()
      .filter((m) => m.type === 'Expense')
      .map((m) => {
        const d = new Date(m.date);
        return { movement: m, day: d.getDate() };
      });
  }

  totalCommitted() {
    return this.eventsThisMonth().reduce((s, e) => s + e.movement.amount, 0);
  }

  nextEvent(): string {
    const todayDay = this.today.getDate();
    const upcoming = this.eventsThisMonth()
      .filter((e) => e.day >= todayDay)
      .sort((a, b) => a.day - b.day);
    if (upcoming.length === 0) return '—';
    const next = upcoming[0];
    return `${next.day} — ${next.movement.description ?? next.movement.categoryName ?? '—'}`;
  }

  eventsForDay(day: number): CalEvent[] {
    return this.eventsThisMonth().filter((e) => e.day === day);
  }

  pendingItems = computed(() => {
    const p = this.page();
    if (!p) return [];
    return p.items;
  });

  calendarCells() {
    const year = this.year();
    const month = this.month();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; events: CalEvent[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: 0, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, events: this.eventsForDay(d) });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, events: [] });
    return cells;
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

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  loadData() {
    this.loading.set(true);
    this.sub.add(
      this.api.getMovements(this.yearMonth(), 1, 200).subscribe({
        next: (r) => {
          this.movements.set(r.items);
          this.loading.set(false);
          this.loadTablePage(1);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  loadTablePage(p: number) {
    this.currentPage.set(p);
    this.sub.add(
      this.api.getMovements(this.yearMonth(), p, this.pageSize()).subscribe({
        next: (r) => this.page.set(r),
      }),
    );
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.loadTablePage(1);
  }

  prevPage() {
    if (this.currentPage() > 1) this.loadTablePage(this.currentPage() - 1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.loadTablePage(this.currentPage() + 1);
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

  sourceLabel(st: string | null): string {
    if (!st) return '—';
    const map: Record<string, string> = {
      Cash: this.i18n.t('transactions.cash'),
      OwnAccount: this.i18n.t('transactions.own_account'),
      CreditCard: this.i18n.t('transactions.credit_card'),
      Loan: this.i18n.t('transactions.loan'),
    };
    return map[st] ?? st;
  }

  subTypeLabel(st: string | null): string {
    if (!st) return '—';
    const map: Record<string, string> = {
      Income: this.i18n.t('transactions.income'),
      Expense: this.i18n.t('transactions.expense'),
      LoanReceived: this.i18n.t('transactions.loan_received'),
      LoanGiven: this.i18n.t('transactions.loan_given'),
      Saving: this.i18n.t('transactions.saving'),
    };
    return map[st] ?? st;
  }

  rowCount(): number {
    return this.page()?.total ?? 0;
  }
}