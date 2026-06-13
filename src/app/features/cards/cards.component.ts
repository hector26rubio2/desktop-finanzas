import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  viewChild,
  TemplateRef,
} from '@angular/core';
import { formatNumber } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  AccountResponse,
  AccountBalance,
  MovementResponse,
  PagedResult,
} from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { CatIconComponent } from '@ui/atoms/cat-icon/cat-icon.component';
import { MovementDetailModalComponent } from '@ui/organisms/movement-detail-modal/movement-detail-modal.component';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { FmtDatePipe } from '../../shared/pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';
import { parseDate } from '../../shared/utils/date';
import type { InstallmentResponse } from '../../shared/models/installment.model';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';

interface CardWithBalance extends AccountResponse {
  balance: AccountBalance;
}

type MovTpl = TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>;

@Component({
  selector: 'app-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CatIconComponent,
    FmtDatePipe,
    MovementDetailModalComponent,
    ModalComponent,
    DataTableComponent,
    KpiStripComponent,
  ],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.css',
})
export class CardsComponent implements OnInit {
  cards = signal<CardWithBalance[]>([]);
  loading = signal(true);
  filterCcy = signal('');
  filterBank = signal('');
  searchQuery = signal('');
  selectedId = signal<string | null>(null);
  selectedMovement = signal<MovementResponse | null>(null);
  cardMovements = signal<PagedResult<MovementResponse> | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  today = new Date();
  installments = signal<InstallmentResponse[]>([]);

  showInstModal = signal(false);
  instSaving = signal(false);

  private api = inject(ApiService);
  public i18n = inject(I18nService);
  private fb = inject(FormBuilder);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;
  private destroyRef = inject(DestroyRef);

  instForm = this.fb.group({
    description: ['', Validators.required],
    totalAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    installmentsCount: [null as number | null, [Validators.required, Validators.min(2), Validators.max(120)]],
    startDate: [new Date().toISOString().slice(0, 10), Validators.required],
  });

  dateCell = viewChild<MovTpl>('dateCell');
  conceptCell = viewChild<MovTpl>('conceptCell');
  cuotaCell = viewChild<MovTpl>('cuotaCell');
  interesCell = viewChild<MovTpl>('interesCell');
  amountCell = viewChild<MovTpl>('amountCell');

  trackById = (m: MovementResponse) => m.id;

  movementCols = computed<ColumnDef<MovementResponse>[]>(() => [
    { key: 'date', header: this.i18n.t('transactions.table_fecha'), width: '100px', cellTpl: this.dateCell() },
    { key: 'description', header: this.i18n.t('transactions.table_concepto'), cellTpl: this.conceptCell() },
    { key: 'loanInstallments', header: this.i18n.t('cards.cuota'), width: '60px', cellTpl: this.cuotaCell() },
    { key: 'loanInterestRate', header: this.i18n.t('cards.interes'), width: '60px', cellTpl: this.interesCell() },
    { key: 'amount', header: this.i18n.t('transactions.table_monto'), numeric: true, cellTpl: this.amountCell() },
  ]);

  uniqueCurrencies = computed(() => {
    const ccySet = new Set(this.cards().map((c) => c.currency));
    return Array.from(ccySet).sort();
  });

  uniqueBanks = computed(() => {
    const bankSet = new Set(
      this.cards()
        .map((c) => c.bank)
        .filter((b): b is string => !!b),
    );
    return Array.from(bankSet).sort();
  });

  filteredCards = computed(() => {
    let result = this.cards();
    const ccy = this.filterCcy();
    const bank = this.filterBank();
    if (ccy) result = result.filter((c) => c.currency === ccy);
    if (bank) result = result.filter((c) => c.bank === bank);
    return result;
  });

  selectedCard = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.cards().find((c) => c.id === id) ?? null;
  });

  totalPages = computed(() => {
    const p = this.cardMovements();
    if (!p) return 1;
    return Math.ceil(p.total / p.pageSize) || 1;
  });

  movementItems = computed(() => {
    const items = this.cardMovements()?.items ?? [];
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (m) =>
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.categoryName ?? '').toLowerCase().includes(q) ||
        (m.accountName ?? '').toLowerCase().includes(q) ||
        m.amount.toString().includes(q) ||
        m.currency.toLowerCase().includes(q),
    );
  });

  totalUsed = computed(() => this.filteredCards().reduce((s, c) => s + c.balance.usedInCycle, 0));

  summaryItems = computed<KpiStripItem[]>(() => {
    const fmt = (v: number) => formatNumber(v, 'en-US', '1.0-0');
    return [
      { label: this.i18n.t('cards.total_utilizado'), value: fmt(this.totalUsed()), color: 'var(--negative)' },
      { label: this.i18n.t('cards.disponible'), value: fmt(this.totalAvailable()), color: 'var(--positive)' },
      {
        label: this.i18n.t('cards.utilizacion_global'),
        value: this.globalUsePct() + '%',
        color: this.useColor(this.globalUsePct()),
      },
    ];
  });
  totalLimit = computed(() => this.filteredCards().reduce((s, c) => s + (c.creditLimit ?? 0), 0));
  totalAvailable = computed(() => this.filteredCards().reduce((s, c) => s + this.available(c), 0));
  globalUsePct = computed(() => {
    const limit = this.totalLimit();
    return limit > 0 ? Math.min(100, Math.round((this.totalUsed() / limit) * 100)) : 0;
  });

  selectedExpenses = computed(() => {
    const items = this.cardMovements()?.items ?? [];
    return items.filter((m) => m.type === 'Expense');
  });

  selectedTotalExpenses = computed(() =>
    this.selectedExpenses().reduce((s, m) => s + (m.currency === 'ARS' ? m.amount : m.amount * m.trmApplied), 0),
  );

  selectedTotalInterest = computed(() => {
    const card = this.selectedCard();
    if (!card || !card.interestRate) return 0;
    return Math.round(this.selectedTotalExpenses() * (card.interestRate / 100));
  });

  selectedTotalToPay = computed(() => this.selectedTotalExpenses() + this.selectedTotalInterest());

  /** Compras en cuotas activas de la tarjeta seleccionada */
  selectedInstallments = computed(() => {
    const id = this.selectedId();
    if (!id) return [];
    return this.installments().filter((i) => i.accountId === id && i.isActive);
  });

  instPct(inst: InstallmentResponse): number {
    return Math.round((inst.paidCount / inst.installmentsCount) * 100);
  }

  openInstModal() {
    const card = this.selectedCard();
    this.instForm.reset({
      description: '',
      totalAmount: null,
      installmentsCount: null,
      startDate: new Date().toISOString().slice(0, 10),
    });
    this.showInstModal.set(true);
  }

  closeInstModal() {
    this.showInstModal.set(false);
  }

  saveNewInst() {
    this.instForm.markAllAsTouched();
    if (this.instForm.invalid) return;
    const card = this.selectedCard();
    if (!card) return;
    this.instSaving.set(true);
    const v = this.instForm.value;
    const cuotas = v.installmentsCount!;
    const totalAmount = v.totalAmount!;
    const dateStr = v.startDate!;
    const description = v.description!;

    // Crear movimiento Expense con CreditCard
    const movReq = {
      type: 'Expense' as const,
      sourceType: 'CreditCard',
      amount: totalAmount / cuotas,
      currency: card.currency,
      trmApplied: 1,
      date: dateStr + 'T00:00',
      description,
      accountId: card.id,
      loanInstallments: cuotas,
    };
    // Crear InstallmentPurchase
    const instReq = {
      description,
      accountId: card.id,
      totalAmount,
      currency: card.currency,
      trmApplied: 1,
      installmentsCount: cuotas,
      paidCount: 0,
      startDate: dateStr,
    };

    forkJoin([
      this.api.createMovement(movReq),
      this.api.createInstallment(instReq),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([, inst]) => {
          this.installments.update((l) => [...l, inst]);
          this.instSaving.set(false);
          this.showInstModal.set(false);
          this.loadMovements(card.id);
        },
        error: () => this.instSaving.set(false),
      });
  }

  deleteInst(id: string) {
    this.api
      .deleteInstallment(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.installments.update((l) => l.filter((i) => i.id !== id));
      });
  }

  markInstallmentPaid(inst: InstallmentResponse) {
    const newCount = Math.min(inst.paidCount + 1, inst.installmentsCount);
    this.api
      .updateInstallmentPaid(inst.id, newCount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        this.installments.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      });
  }

  currentMonth(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  }

  ngOnInit() {
    this.api
      .getInstallments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.installments.set(list), error: () => {} });
    this.api
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts) => {
          const creditCards = accounts.filter((a) => a.type === 'Credit' && a.isActive);
          if (creditCards.length === 0) {
            this.loading.set(false);
            return;
          }
          forkJoin(creditCards.map((c) => this.api.getAccountBalance(c.id)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (balances) => {
                const combined = creditCards.map((c, i) => ({ ...c, balance: balances[i] }));
                this.cards.set(combined);
                if (combined.length) {
                  this.selectedId.set(combined[0].id);
                  this.loadMovements(combined[0].id);
                }
                this.loading.set(false);
              },
              error: () => {
                this.cards.set(creditCards.map((c) => ({ ...c, balance: { balance: 0, usedInCycle: 0 } })));
                this.loading.set(false);
              },
            });
        },
        error: () => this.loading.set(false),
      });
  }

  selectCard(id: string) {
    this.selectedId.set(id);
    this.currentPage.set(1);
    this.loadMovements(id);
  }

  loadMovements(accountId: string) {
    this.api
      .getMovements(this.currentMonth(), this.currentPage(), this.pageSize(), { accountId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.cardMovements.set(r),
      });
  }

  onPageChange(p: number) {
    this.currentPage.set(p);
    const id = this.selectedId();
    if (id) this.loadMovements(id);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    const id = this.selectedId();
    if (id) this.loadMovements(id);
  }

  rowCount = computed(() => this.cardMovements()?.total ?? 0);

  available(card: CardWithBalance): number {
    return Math.max(0, (card.creditLimit ?? 0) - card.balance.usedInCycle);
  }

  usePct(card: CardWithBalance): number {
    if (!card.creditLimit) return 0;
    return Math.min(100, Math.round((card.balance.usedInCycle / card.creditLimit) * 100));
  }

  cyclePct(card: CardWithBalance): number {
    const day = this.today.getDate();
    const close = card.billingDay ?? 1;
    const dayInCycle = day > close ? day - close : 30 - close + day;
    return Math.min(100, Math.max(0, Math.round((dayInCycle / 30) * 100)));
  }

  useColor(pct: number): string {
    if (pct > 70) return 'var(--negative)';
    if (pct > 40) return 'var(--warning)';
    return 'var(--positive)';
  }

  cardBrand(card: CardWithBalance): string {
    const n = (card.name ?? '').toLowerCase();
    if (n.includes('visa')) return 'VISA';
    if (n.includes('master') || n.includes('mastercard')) return 'MASTERCARD';
    if (n.includes('amex') || n.includes('american')) return 'AMEX';
    if (n.includes('naranja')) return 'NARANJA';
    if (n.includes('cabal')) return 'CABAL';
    if (n.includes('argentina')) return 'ARGENTINA';
    return '';
  }

  openDetail(m: MovementResponse) {
    this.selectedMovement.set(m);
  }

  closeDetail() {
    this.selectedMovement.set(null);
  }

  cuotaLabel(m: MovementResponse): string {
    if (!m.loanInstallments) return '';
    return `${this.currentInstallment(m)}/${m.loanInstallments}`;
  }

  hasInstallment(m: MovementResponse): boolean {
    return m.loanInstallments !== null && m.loanInstallments !== undefined && m.loanInstallments > 1;
  }

  currentInstallment(m: MovementResponse): number {
    const start = parseDate(m.date);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    return Math.min(Math.max(elapsed, 1), m.loanInstallments ?? 1);
  }
}
