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
import { RouterLink, Router } from '@angular/router';
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
import { FieldErrorComponent } from '@ui/atoms/field-error/field-error.component';
import { FmtDatePipe } from '../../shared/pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';
import { parseDate } from '../../shared/utils/date';
import type { InstallmentResponse } from '../../shared/models/installment.model';
import { installmentPaymentKey } from '../../shared/services/api/installments-api.service';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { resolveViewLoadState } from '../../shared/utils/view-load-state';
import { SkeletonComponent } from '@ui/atoms/skeleton/skeleton.component';

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
    FieldErrorComponent,
    DataTableComponent,
    KpiStripComponent,
    SkeletonComponent,
  ],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.css',
})
export class CardsComponent implements OnInit {
  cards = signal<CardWithBalance[]>([]);
  loading = signal(true);
  loadError = signal(false);
  loadState = computed(() => resolveViewLoadState(this.loading(), this.loadError(), this.cards().length));
  filterCcy = signal('');
  filterBank = signal('');
  searchQuery = signal('');
  selectedId = signal<string | null>(null);
  selectedMovement = signal<MovementResponse | null>(null);
  selectedInstallment = signal<InstallmentResponse | null>(null);
  cardMovements = signal<PagedResult<MovementResponse> | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  today = new Date();
  installments = signal<InstallmentResponse[]>([]);
  fundingAccounts = signal<AccountResponse[]>([]);
  showPaymentModal = signal(false);
  paymentSaving = signal(false);
  paymentIdempotencyKey = signal('');

  showInstModal = signal(false);
  instSaving = signal(false);

  private api = inject(ApiService);
  private router = inject(Router);
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

  paymentForm = this.fb.group({
    sourceAccountId: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    description: ['Pago de tarjeta'],
  });

  openPaymentModal() {
    const card = this.selectedCard();
    if (!card) return;
    const sources = this.fundingAccounts().filter((a) => a.currency === card.currency);
    this.paymentForm.reset({
      sourceAccountId: sources[0]?.id ?? '',
      amount: this.outstandingDebt(card) || null,
      date: new Date().toISOString().slice(0, 10),
      description: `Pago ${card.name}`,
    });
    this.paymentIdempotencyKey.set(crypto.randomUUID());
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    if (!this.paymentSaving()) this.showPaymentModal.set(false);
  }

  savePayment() {
    this.paymentForm.markAllAsTouched();
    const card = this.selectedCard();
    if (this.paymentForm.invalid || !card) return;
    const value = this.paymentForm.getRawValue();
    this.paymentSaving.set(true);
    this.api
      .createCreditCardPayment(
        {
          sourceAccountId: value.sourceAccountId!,
          creditAccountId: card.id,
          amount: value.amount!,
          currency: card.currency,
          trmApplied: 1,
          date: value.date!,
          description: value.description || undefined,
        },
        this.paymentIdempotencyKey(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentSaving.set(false);
          this.showPaymentModal.set(false);
          this.loadMovements(card.id);
          this.api
            .getAccountBalance(card.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((balance) =>
              this.cards.update((list) => list.map((item) => (item.id === card.id ? { ...item, balance } : item))),
            );
        },
        error: () => this.paymentSaving.set(false),
      });
  }

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

  paymentFundingAccounts = computed(() => {
    const currency = this.selectedCard()?.currency;
    return this.fundingAccounts().filter((account) => !currency || account.currency === currency);
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

  totalUsed = computed(() => this.filteredCards().reduce((s, c) => s + this.outstandingDebt(c), 0));

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
    this.selectedExpenses().reduce((s, m) => s + (m.amountBase ?? m.amount * m.trmApplied), 0),
  );

  selectedTotalInterest = computed(() => {
    const card = this.selectedCard();
    if (!card || !card.interestRate) return 0;
    return Math.round(this.selectedTotalExpenses() * (card.interestRate / 100));
  });

  selectedTotalToPay = computed(() => this.selectedTotalExpenses() + this.selectedTotalInterest());

  instMonthlyWithInterest = computed(() => {
    const total = this.instForm.value.totalAmount;
    const n = this.instForm.value.installmentsCount;
    if (!total || !n) return 0;
    const base = total / n;
    const rate = this.selectedCard()?.interestRate ?? 0;
    return base * (1 + rate / 100);
  });

  selectedInstallments = computed(() => {
    const id = this.selectedId();
    if (!id) return [];
    return this.installments().filter((i) => i.accountId === id && i.isActive);
  });

  instPct(inst: InstallmentResponse): number {
    return Math.round((inst.paidCount / inst.installmentsCount) * 100);
  }

  instMonthlyInterest(inst: InstallmentResponse): number {
    const rate = this.selectedCard()?.interestRate ?? 0;
    return inst.monthlyAmount * (rate / 100);
  }

  instMonthlyTotal(inst: InstallmentResponse): number {
    return inst.monthlyAmount + this.instMonthlyInterest(inst);
  }

  openInstModal() {
    const accountId = this.selectedId();
    this.router.navigate(['/movements'], {
      queryParams: { preset: 'cc', ...(accountId ? { accountId } : {}) },
    });
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

    const movReq = {
      type: 'Expense' as const,
      sourceType: 'CreditCard',
      amount: totalAmount,
      currency: card.currency,
      trmApplied: 1,
      date: dateStr + 'T00:00',
      description,
      accountId: card.id,
      loanInstallments: cuotas,
      loanInterestRate: card.interestRate || undefined,
    };

    this.api
      .createMovement(movReq)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.instSaving.set(false);
          this.showInstModal.set(false);
          this.loadMovements(card.id);
          this.api
            .getInstallments()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((list) => this.installments.set(list));
        },
        error: () => this.instSaving.set(false),
      });
  }

  markInstallmentPaid(inst: InstallmentResponse) {
    const source = this.fundingAccounts().find((a) => a.currency === inst.currency);
    if (!source) return;
    this.api
      .payInstallment(inst.id, source.id, installmentPaymentKey(inst))
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
    this.load();
  }

  retry() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.cardMovements.set(null);
    forkJoin({ installments: this.api.getInstallments(), accounts: this.api.getAccounts() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ installments, accounts }) => {
          this.installments.set(installments);
          this.fundingAccounts.set(accounts.filter((a) => a.type !== 'Credit' && a.isActive));
          const creditCards = accounts.filter((a) => a.type === 'Credit' && a.isActive);
          if (creditCards.length === 0) {
            this.cards.set([]);
            this.selectedId.set(null);
            this.loading.set(false);
            return;
          }
          forkJoin(creditCards.map((c) => this.api.getAccountBalance(c.id)))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (balances) => {
                const combined = creditCards.map((c, i) => ({ ...c, balance: balances[i] }));
                this.cards.set(combined);
                const currencies = [...new Set(combined.map((card) => card.currency))].sort();
                if (currencies.length > 1 && !currencies.includes(this.filterCcy())) {
                  this.filterCcy.set(currencies[0]);
                } else if (currencies.length <= 1) {
                  this.filterCcy.set('');
                }
                if (combined.length) {
                  this.selectedId.set(combined[0].id);
                  this.loadMovements(combined[0].id);
                }
                this.loading.set(false);
              },
              error: () => {
                this.loadError.set(true);
                this.loading.set(false);
              },
            });
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
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
        error: () => this.loadError.set(true),
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
    return Math.max(0, (card.creditLimit ?? 0) - this.outstandingDebt(card));
  }

  usePct(card: CardWithBalance): number {
    if (!card.creditLimit) return 0;
    return Math.min(100, Math.round((this.outstandingDebt(card) / card.creditLimit) * 100));
  }

  outstandingDebt(card: CardWithBalance): number {
    return card.balance.outstandingDebt ?? card.balance.usedInCycle;
  }

  cycleSpend(card: CardWithBalance): number {
    return card.balance.cycleSpend ?? this.outstandingDebt(card);
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
    const inst = m.installmentPurchaseId
      ? (this.installments().find((i) => i.id === m.installmentPurchaseId) ?? null)
      : null;
    this.selectedInstallment.set(inst);
  }

  closeDetail() {
    this.selectedMovement.set(null);
    this.selectedInstallment.set(null);
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
