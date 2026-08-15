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
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  MovementResponse,
  CategoryResponse,
  AccountResponse,
  AccountBalance,
  PagedResult,
} from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { CatIconComponent } from '@ui/atoms/cat-icon/cat-icon.component';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { FieldErrorComponent } from '@ui/atoms/field-error/field-error.component';
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { formatMoney } from '../../shared/utils/money';
import { MovementDetailModalComponent } from '@ui/organisms/movement-detail-modal/movement-detail-modal.component';
import { FmtDatePipe } from '../../shared/pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';
import { parseDate } from '../../shared/utils/date';
import type { InstallmentResponse } from '../../shared/models/installment.model';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { DynamicFormComponent } from '@ui/organisms/dynamic-form/dynamic-form.component';
import { isGenericMovementSource, movementFormFields } from './movement-form.schema';
import { SkeletonComponent } from '@ui/atoms/skeleton/skeleton.component';

type MovTpl = TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>;

const MONTH_PAGE_SIZE = 10_000;

@Component({
  selector: 'app-movements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FmtDatePipe,
    CatIconComponent,
    ModalComponent,
    FieldErrorComponent,
    ConfirmDialogComponent,
    MovementDetailModalComponent,
    DataTableComponent,
    DynamicFormComponent,
    KpiStripComponent,
    SkeletonComponent,
  ],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.css',
})
export class MovementsComponent implements OnInit {

  readonly useDynamicMovementForm = false;
  page = signal<PagedResult<MovementResponse> | null>(null);
  summary = signal<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);

  summaryItems = computed<KpiStripItem[] | null>(() => {
    const s = this.summary();
    if (!s) return null;
    const currency = this.auth.baseCurrency();
    return [
      { label: this.i18n.t('transactions.total_ingresos'), value: formatMoney(s.totalIncome, currency), color: 'var(--positive)' },
      { label: this.i18n.t('transactions.total_gastos'), value: formatMoney(s.totalExpense, currency), color: 'var(--negative)' },
      { label: this.i18n.t('transactions.balance_neto'), value: formatMoney(s.balance, currency) },
    ];
  });
  categories = signal<CategoryResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  accountBalances = signal<Record<string, AccountBalance>>({});
  currentMonth = signal(new Date().toISOString().slice(0, 7));
  currentPage = signal(1);
  pageSize = signal(20);
  saving = signal(false);
  showModal = signal(false);
  showTransferModal = signal(false);
  showDeleteModal = signal(false);
  showDetailModal = signal(false);
  selectedMovement = signal<MovementResponse | null>(null);
  deletingIds = signal<string[]>([]);
  editingMovement = signal<MovementResponse | null>(null);
  installments = signal<InstallmentResponse[]>([]);

  formAccountId = signal('');
  formCurrency = signal('ARS');
  formSourceType = signal('Cash');
  formType = signal<'Income' | 'Expense'>('Expense');
  lockedToCreditCard = signal(false);
  transferIdempotencyKey = signal('');
  transferSourceId = signal('');

  filterCcy = '';
  filterCat = '';
  filterAcc = '';
  drillType: 'Income' | 'Expense' | undefined;
  drillPortfolioEntityId: string | undefined;
  drillPortfolioType: string | undefined;
  searchQuery = signal('');

  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  baseCurrency = this.auth.baseCurrency;

  dateCell = viewChild<MovTpl>('dateCell');
  conceptCell = viewChild<MovTpl>('conceptCell');
  categoryCell = viewChild<MovTpl>('categoryCell');
  sourceCell = viewChild<MovTpl>('sourceCell');
  typeCell = viewChild<MovTpl>('typeCell');
  amountCell = viewChild<MovTpl>('amountCell');
  actionsCell = viewChild<MovTpl>('actionsCell');

  trackById = (m: MovementResponse) => m.id;

  cols = computed<ColumnDef<MovementResponse>[]>(() => [
    {
      key: 'date',
      header: this.i18n.t('transactions.table_fecha'),
      width: '110px',
      sortable: true,
      cellTpl: this.dateCell(),
    },
    {
      key: 'description',
      header: this.i18n.t('transactions.table_concepto'),
      sortable: true,
      cellTpl: this.conceptCell(),
    },
    { key: 'categoryName', header: this.i18n.t('transactions.table_categoria'), cellTpl: this.categoryCell() },
    { key: 'sourceType', header: this.i18n.t('transactions.source'), width: '100px', cellTpl: this.sourceCell() },
    { key: 'type', header: this.i18n.t('transactions.table_tipo'), width: '70px', cellTpl: this.typeCell() },
    {
      key: 'amount',
      header: this.i18n.t('transactions.table_monto'),
      numeric: true,
      sortable: true,
      cellTpl: this.amountCell(),
    },
    { key: 'id', header: '', width: '36px', cellTpl: this.actionsCell() },
  ]);

  totalPages = computed(() => {
    const p = this.page();
    if (!p) return 1;
    return Math.ceil(p.total / p.pageSize) || 1;
  });

  debitAccounts = computed(() => this.accounts().filter((a) => a.type === 'Debit'));
  creditAccounts = computed(() => this.accounts().filter((a) => a.type === 'Credit'));
  cashAccounts = computed(() => this.accounts().filter((a) => a.type === 'Cash'));
  transferAccounts = computed(() => this.accounts().filter((a) => a.type === 'Cash' || a.type === 'Debit'));
  transferDestinationAccounts = computed(() => {
    const sourceId = this.transferSourceId();
    const source = this.accounts().find((a) => a.id === sourceId);
    return this.transferAccounts().filter((a) => a.id !== sourceId && (!source || a.currency === source.currency));
  });

  filteredCategories = computed(() => {
    const type = this.formType();
    return this.categories().filter((c) => c.type === type);
  });

  selectedAccount = computed(() => {
    const aid = this.formAccountId();
    if (!aid) return null;
    return this.accounts().find((a) => a.id === aid) ?? null;
  });

  selectedAccountBalance = computed(() => {
    const aid = this.formAccountId();
    if (!aid) return null;
    return this.accountBalances()[aid] ?? null;
  });

  canChangeCurrency = computed(() => {
    const acc = this.selectedAccount();
    if (acc) return false;
    return true;
  });

  showTrm = computed(() => {
    const cur = this.formCurrency();
    return cur !== this.baseCurrency();
  });

  creditCardInfo = computed(() => {
    const acc = this.selectedAccount();
    if (!acc || acc.type !== 'Credit') return null;
    return acc;
  });

  exceedsBalance = computed(() => {
    const acc = this.selectedAccount();
    const bal = this.selectedAccountBalance();
    const amount = this.movForm.value.amount;
    if (!acc || !bal || !amount) return false;
    if (acc.type === 'Credit') {
      const available = (acc.creditLimit ?? 0) - (bal.outstandingDebt ?? bal.usedInCycle);
      return amount > available;
    }
    return amount > bal.balance;
  });

  originOptions = computed(() => {
    const type = this.formType();
    if (type === 'Income') {
      return [
        { value: 'Cash', label: this.i18n.t('transactions.cash') },
        { value: 'OwnAccount', label: this.i18n.t('transactions.own_account') },
      ];
    }
    return [
      { value: 'Cash', label: this.i18n.t('transactions.cash') },
      { value: 'OwnAccount', label: this.i18n.t('transactions.own_account') },
      { value: 'CreditCard', label: this.i18n.t('transactions.credit_card') },
    ];
  });

  movForm = this.fb.group({
    type: ['Expense' as 'Income' | 'Expense', Validators.required],
    sourceType: ['Cash' as string],
    loanInstallments: [null as number | null, [Validators.min(1), Validators.max(36)]],
    loanInterestRate: [null as number | null],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['ARS', Validators.required],
    trmApplied: [1, Validators.required],
    date: [new Date().toISOString().slice(0, 16), Validators.required],
    description: [''],
    categoryId: [''],
    accountId: [''],

    isRecurring: [false],
    recFrequency: ['Monthly' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'],
    recInterval: [1, [Validators.min(1)]],
    recDayOfMonth: [null as number | null],
    recEndDate: [''],
  });
  dynamicMovementFields = computed(() =>
    movementFormFields({
      baseCurrency: this.baseCurrency(),
      categories: this.filteredCategories().map((c) => ({ value: c.id, label: c.name })),
      accounts: this.accounts().map((a) => ({ value: a.id, label: a.name })),
    }),
  );

  transferForm = this.fb.group({
    sourceAccountId: ['', Validators.required],
    destinationAccountId: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    trmApplied: [1, [Validators.required, Validators.min(0.000001)]],
    date: [new Date().toISOString().slice(0, 16), Validators.required],
    description: [''],
    isSaving: [false],
  });

  monthMovements = signal<MovementResponse[] | null>(null);

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const p = this.page();
    if (!q) return p ? p.items : [];

    const source = this.monthMovements() ?? p?.items ?? [];
    return source.filter(
      (m) =>
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.categoryName ?? '').toLowerCase().includes(q) ||
        (m.accountName ?? '').toLowerCase().includes(q) ||
        m.amount.toString().includes(q) ||
        m.currency.toLowerCase().includes(q),
    );
  });

  currentInstallment(m: MovementResponse): number {
    const start = parseDate(m.date);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    return Math.min(Math.max(elapsed, 1), m.loanInstallments ?? 1);
  }

  ngOnInit() {
    const drill = this.route.snapshot.queryParamMap;
    const drillYear = drill.get('year'),
      drillMonth = drill.get('month'),
      drillType = drill.get('type');
    if (drillYear && drillMonth) this.currentMonth.set(`${drillYear}-${drillMonth.padStart(2, '0')}`);
    this.filterCat = drill.get('categoryId') ?? '';
    if (drillType === 'Income' || drillType === 'Expense') this.drillType = drillType;
    this.drillPortfolioEntityId = drill.get('portfolioEntityId') ?? undefined;
    this.drillPortfolioType = drill.get('portfolioType') ?? undefined;
    this.api
      .getInstallments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.installments.set(list), error: () => {} });
    this.movForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.formAccountId.set(v.accountId ?? '');
      this.formSourceType.set(v.sourceType ?? 'Cash');
      this.formType.set(v.type ?? 'Expense');
      const account = v.accountId ? this.accounts().find((item) => item.id === v.accountId) : null;
      if (account && v.currency !== account.currency) {
        this.movForm.patchValue({ currency: account.currency }, { emitEvent: false });
        this.formCurrency.set(account.currency);
      } else {
        this.formCurrency.set(v.currency ?? 'ARS');
      }
      if (account?.type === 'Credit' && v.sourceType === 'CreditCard' && v.loanInterestRate == null) {
        this.movForm.patchValue({ loanInterestRate: account.interestRate ?? 0 }, { emitEvent: false });
      }
    });
    this.loadPage(1);
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.categories.set(c) });
    this.api
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => {
          this.accounts.set(a);
          const ids = a.map((acc) => acc.id);
          if (ids.length > 0) {
            this.api
              .getAccountBalances(ids)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (balances) => this.accountBalances.set(balances),
                error: () => {},
              });
          }
          const params = this.route.snapshot.queryParamMap;
          if (params.get('preset') === 'cc') {
            const accountId = params.get('accountId');
            this.openCreditCardPreset(accountId);
            this.router.navigate([], { replaceUrl: true, queryParams: {} });
          }
        },
      });
  }

  openCreditCardPreset(accountId: string | null) {
    const acc = accountId ? this.accounts().find((a) => a.id === accountId) : this.creditAccounts()[0];
    this.editingMovement.set(null);
    this.movForm.reset({
      type: 'Expense',
      sourceType: 'CreditCard',
      loanInstallments: null,
      loanInterestRate: acc?.interestRate ?? null,
      amount: null,
      currency: acc?.currency ?? 'ARS',
      trmApplied: 1,
      date: new Date().toISOString().slice(0, 16),
      description: '',
      categoryId: '',
      accountId: acc?.id ?? '',
    });
    this.formType.set('Expense');
    this.formSourceType.set('CreditCard');
    this.formAccountId.set(acc?.id ?? '');
    this.formCurrency.set(acc?.currency ?? 'ARS');
    this.lockedToCreditCard.set(true);
    this.showModal.set(true);
  }

  setType(type: 'Income' | 'Expense') {
    this.movForm.patchValue({ type });
    if (type === 'Income' && this.movForm.value.sourceType === 'CreditCard') {
      this.movForm.patchValue({ sourceType: 'Cash', accountId: '' });
      this.formSourceType.set('Cash');
      this.formAccountId.set('');
    }
    this.formType.set(type);
  }

  setSource(source: string) {
    if (!isGenericMovementSource(source)) return;
    const patches: Record<string, unknown> = {
      sourceType: source,
      accountId: '',
      loanInstallments: null,
      loanInterestRate: null,
    };
    this.movForm.patchValue(patches);
    this.formSourceType.set(source);
    this.formAccountId.set('');

    if (source === 'Cash') {
      const cash = this.cashAccounts();
      if (cash.length === 1) {
        this.movForm.patchValue({ accountId: cash[0].id });
        this.formAccountId.set(cash[0].id);
        this.movForm.patchValue({ currency: cash[0].currency });
        this.formCurrency.set(cash[0].currency);
      }
    } else if (source === 'OwnAccount') {
      const debits = this.debitAccounts();
      if (debits.length === 1) {
        this.movForm.patchValue({ accountId: debits[0].id });
        this.formAccountId.set(debits[0].id);
        this.movForm.patchValue({ currency: debits[0].currency });
        this.formCurrency.set(debits[0].currency);
      }
    } else if (source === 'CreditCard') {
      const credits = this.creditAccounts();
      if (credits.length === 1) {
        this.movForm.patchValue({ accountId: credits[0].id });
        this.formAccountId.set(credits[0].id);
        this.movForm.patchValue({ currency: credits[0].currency });
        this.formCurrency.set(credits[0].currency);
      }
    }
  }

  onAccountChange() {
    const acc = this.selectedAccount();
    if (acc) {
      this.movForm.patchValue({ currency: acc.currency });
      this.formCurrency.set(acc.currency);
    }
  }

  loadPage(p: number) {
    this.currentPage.set(p);

    this.monthMovements.set(null);
    const filters: {
      currency?: string;
      categoryId?: string;
      accountId?: string;
      type?: 'Income' | 'Expense';
      portfolioEntityId?: string;
      portfolioType?: string;
    } = {};
    if (this.filterCcy) filters.currency = this.filterCcy;
    if (this.filterCat) filters.categoryId = this.filterCat;
    if (this.filterAcc) filters.accountId = this.filterAcc;
    if (this.drillType) filters.type = this.drillType;
    if (this.drillPortfolioEntityId) filters.portfolioEntityId = this.drillPortfolioEntityId;
    if (this.drillPortfolioType) filters.portfolioType = this.drillPortfolioType;
    this.api
      .getMovements(this.currentMonth(), p, this.pageSize(), filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.page.set(r),
      });
    this.api
      .getMovementSummary(this.currentMonth())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.summary.set(s),
      });
  }

  onSearch(query: string) {
    this.searchQuery.set(query);
    if (!query.trim() || this.monthMovements() !== null) return;
    this.api
      .getMovements(this.currentMonth(), 1, MONTH_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.monthMovements.set(r.items) });
  }

  onPageChange(p: number) {
    this.loadPage(p);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.loadPage(1);
  }

  onMonthChange(e: Event) {
    this.currentMonth.set((e.target as HTMLInputElement).value);
    this.loadPage(1);
  }

  openEdit(m: MovementResponse) {
    this.showDetailModal.set(false);
    this.selectedMovement.set(null);
    this.editingMovement.set(m);
    const d = parseDate(m.date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    this.movForm.reset({
      type: m.type,
      sourceType: m.sourceType ?? 'Cash',
      loanInstallments: m.loanInstallments,
      loanInterestRate: m.loanInterestRate,
      amount: m.amount,
      currency: m.currency,
      trmApplied: m.trmApplied ?? 1,
      date: local,
      description: m.description ?? '',
      categoryId: m.categoryId ?? '',
      accountId: m.accountId ?? '',
    });
    this.formType.set(m.type);
    this.formSourceType.set(m.sourceType ?? 'Cash');
    this.formAccountId.set(m.accountId ?? '');
    this.formCurrency.set(m.currency);
    this.showModal.set(true);
  }

  openCreate() {
    this.editingMovement.set(null);

    const def = this.accounts().find((a) => a.isDefault);
    const sourceType = def
      ? def.type === 'Cash'
        ? 'Cash'
        : def.type === 'Credit'
          ? 'CreditCard'
          : 'OwnAccount'
      : 'Cash';
    this.movForm.reset({
      type: 'Expense',
      sourceType,
      loanInstallments: null,
      loanInterestRate: null,
      amount: null,
      currency: def?.currency ?? 'ARS',
      trmApplied: 1,
      date: new Date().toISOString().slice(0, 16),
      description: '',
      categoryId: '',
      accountId: def?.id ?? '',
    });
    this.formType.set('Expense');
    this.formSourceType.set(sourceType);
    this.formAccountId.set(def?.id ?? '');
    this.formCurrency.set(def?.currency ?? 'ARS');
    this.showModal.set(true);
  }

  openTransfer() {
    const source = this.transferAccounts().find((a) => a.isDefault) ?? this.transferAccounts()[0];
    this.transferForm.reset({
      sourceAccountId: source?.id ?? '',
      destinationAccountId: '',
      amount: null,
      currency: source?.currency ?? this.baseCurrency(),
      trmApplied: 1,
      date: new Date().toISOString().slice(0, 16),
      description: '',
      isSaving: false,
    });
    this.transferIdempotencyKey.set(globalThis.crypto.randomUUID());
    this.transferSourceId.set(source?.id ?? '');
    this.showTransferModal.set(true);
  }

  onTransferSourceChange() {
    const source = this.accounts().find((a) => a.id === this.transferForm.controls.sourceAccountId.value);
    this.transferSourceId.set(source?.id ?? '');
    this.transferForm.patchValue({
      destinationAccountId: '',
      currency: source?.currency ?? this.baseCurrency(),
      trmApplied: 1,
    });
  }

  closeTransfer() {
    if (this.saving()) return;
    this.showTransferModal.set(false);
  }

  saveTransfer() {
    if (this.saving()) return;
    this.transferForm.markAllAsTouched();
    if (this.transferForm.invalid) return;
    const value = this.transferForm.getRawValue();
    if (value.sourceAccountId === value.destinationAccountId) return;

    this.saving.set(true);
    this.api
      .createTransfer(
        {
          sourceAccountId: value.sourceAccountId!,
          destinationAccountId: value.destinationAccountId!,
          amount: value.amount!,
          currency: value.currency!,
          trmApplied: value.trmApplied!,
          date: value.date!,
          description: value.description || undefined,
          isSaving: value.isSaving ?? false,
        },
        this.transferIdempotencyKey(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showTransferModal.set(false);
          this.loadPage(this.currentPage());
          const ids = this.accounts().map((account) => account.id);
          this.api
            .getAccountBalances(ids)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (balances) => this.accountBalances.set(balances),
              error: () => undefined,
            });
        },
        error: () => this.saving.set(false),
      });
  }

  closeModal() {
    this.showModal.set(false);
    this.editingMovement.set(null);
    this.lockedToCreditCard.set(false);
  }

  save() {

    if (this.saving()) return;
    this.movForm.markAllAsTouched();
    if (this.movForm.invalid) return;
    const v = this.movForm.value;
    if (!isGenericMovementSource(v.sourceType)) return;
    this.saving.set(true);

    const req = {
      type: v.type!,
      sourceType: v.sourceType,
      loanInstallments: v.loanInstallments || undefined,
      loanInterestRate: v.loanInterestRate || undefined,
      amount: v.amount!,
      currency: v.currency!,
      trmApplied: v.trmApplied ?? 1,
      date: v.date!,
      description: v.description || undefined,
      categoryId: v.categoryId || undefined,
      accountId: v.accountId || undefined,
    };
    const editing = this.editingMovement();

    if (!editing && v.isRecurring) {
      this.api
        .createRecurring({
          type: v.type!,
          amount: v.amount!,
          currency: v.currency!,
          trmApplied: v.trmApplied ?? 1,
          categoryId: v.categoryId || undefined,
          accountId: v.accountId || undefined,
          description: v.description || undefined,
          frequency: v.recFrequency!,
          interval: v.recInterval ?? 1,
          dayOfMonth: v.recFrequency === 'Monthly' ? (v.recDayOfMonth ?? undefined) : undefined,
          startDate: v.date ? v.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          endDate: v.recEndDate || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.showModal.set(false);
            this.editingMovement.set(null);
            this.loadPage(this.currentPage());
          },
          error: () => this.saving.set(false),
        });
      return;
    }

    const op = editing ? this.api.updateMovement(editing.id, req) : this.api.createMovement(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.editingMovement.set(null);
        this.loadPage(this.currentPage());
      },
      error: () => this.saving.set(false),
    });
  }

  askDelete(id: string) {
    this.deletingIds.set([id]);
    this.showDeleteModal.set(true);
  }

  confirmDelete() {
    const ids = this.deletingIds();
    if (ids.length === 0) return;
    this.showDeleteModal.set(false);
    forkJoin(ids.map((id) => this.api.deleteMovement(id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingIds.set([]);
          this.loadPage(this.currentPage());
        },
        error: () => {
          this.deletingIds.set([]);
          this.loadPage(this.currentPage());
        },
      });
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deletingIds.set([]);
  }

  openDetail(m: MovementResponse) {
    this.selectedMovement.set(m);
    this.showDetailModal.set(true);
  }

  closeDetail() {
    this.showDetailModal.set(false);
    this.selectedMovement.set(null);
  }

  catName(cat: CategoryResponse | undefined): string {
    if (!cat) return '—';
    return this.i18n.catName(cat.name, cat.translations);
  }

  rowCount = computed(() => this.page()?.total ?? 0);
}
