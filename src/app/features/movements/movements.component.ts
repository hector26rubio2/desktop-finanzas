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
import { RouterLink } from '@angular/router';
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
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { MovementDetailModalComponent } from '@ui/organisms/movement-detail-modal/movement-detail-modal.component';
import { FmtDatePipe } from '../../shared/pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';
import { parseDate } from '../../shared/utils/date';
import type { InstallmentResponse } from '../../shared/models/installment.model';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';

type MovTpl = TemplateRef<{ $implicit: MovementResponse; row: MovementResponse }>;

@Component({
  selector: 'app-movements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    FmtDatePipe,
    CatIconComponent,
    ModalComponent,
    ConfirmDialogComponent,
    MovementDetailModalComponent,
    DataTableComponent,
  ],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.css',
})
export class MovementsComponent implements OnInit {
  page = signal<PagedResult<MovementResponse> | null>(null);
  summary = signal<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);
  categories = signal<CategoryResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  accountBalances = signal<Record<string, AccountBalance>>({});
  currentMonth = signal(new Date().toISOString().slice(0, 7));
  currentPage = signal(1);
  pageSize = signal(20);
  saving = signal(false);
  showModal = signal(false);
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

  filterCcy = '';
  filterCat = '';
  filterAcc = '';
  searchQuery = signal('');

  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  baseCurrency = computed(() => this.auth.currentUser()?.baseCurrency ?? 'ARS');

  dateCell = viewChild<MovTpl>('dateCell');
  conceptCell = viewChild<MovTpl>('conceptCell');
  categoryCell = viewChild<MovTpl>('categoryCell');
  sourceCell = viewChild<MovTpl>('sourceCell');
  typeCell = viewChild<MovTpl>('typeCell');
  amountCell = viewChild<MovTpl>('amountCell');
  actionsCell = viewChild<MovTpl>('actionsCell');

  trackById = (m: MovementResponse) => m.id;

  cols = computed<ColumnDef<MovementResponse>[]>(() => [
    { key: 'date', header: this.i18n.t('transactions.table_fecha'), width: '110px', cellTpl: this.dateCell() },
    { key: 'description', header: this.i18n.t('transactions.table_concepto'), cellTpl: this.conceptCell() },
    { key: 'categoryName', header: this.i18n.t('transactions.table_categoria'), cellTpl: this.categoryCell() },
    { key: 'sourceType', header: this.i18n.t('transactions.source'), width: '100px', cellTpl: this.sourceCell() },
    { key: 'type', header: this.i18n.t('transactions.table_tipo'), width: '70px', cellTpl: this.typeCell() },
    { key: 'amount', header: this.i18n.t('transactions.table_monto'), numeric: true, cellTpl: this.amountCell() },
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

  loanDirectionLabel = computed(() => {
    const type = this.formType();
    if (type === 'Income') return this.i18n.t('transactions.loan_received');
    return this.i18n.t('transactions.loan_given');
  });

  exceedsBalance = computed(() => {
    const acc = this.selectedAccount();
    const bal = this.selectedAccountBalance();
    const amount = this.movForm.value.amount;
    if (!acc || !bal || !amount) return false;
    if (acc.type === 'Credit') {
      const available = (acc.creditLimit ?? 0) - bal.usedInCycle;
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
        { value: 'Loan', label: this.i18n.t('transactions.loan') },
      ];
    }
    return [
      { value: 'Cash', label: this.i18n.t('transactions.cash') },
      { value: 'OwnAccount', label: this.i18n.t('transactions.own_account') },
      { value: 'CreditCard', label: this.i18n.t('transactions.credit_card') },
      { value: 'Loan', label: this.i18n.t('transactions.loan') },
    ];
  });

  movForm = this.fb.group({
    type: ['Expense' as 'Income' | 'Expense', Validators.required],
    sourceType: ['Cash' as string],
    loanParty: [''],
    loanInstallments: [null as number | null],
    loanInterestRate: [null as number | null],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['ARS', Validators.required],
    trmApplied: [1, Validators.required],
    date: [new Date().toISOString().slice(0, 16), Validators.required],
    description: [''],
    categoryId: [''],
    accountId: [''],
  });

  filteredItems = computed(() => {
    const p = this.page();
    if (!p) return [];
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return p.items;
    return p.items.filter(
      (m) =>
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.categoryName ?? '').toLowerCase().includes(q) ||
        (m.accountName ?? '').toLowerCase().includes(q) ||
        m.amount.toString().includes(q) ||
        m.currency.toLowerCase().includes(q),
    );
  });

  /** Cuotas mensuales comprometidas (compras activas en cuotas) */
  cuotasMes = computed(() =>
    this.installments()
      .filter((i) => i.isActive && i.paidCount < i.installmentsCount)
      .reduce((s, i) => s + i.monthlyAmount * (i.trmApplied || 1), 0),
  );

  activeInstallmentsCount = computed(
    () => this.installments().filter((i) => i.isActive && i.paidCount < i.installmentsCount).length,
  );

  currentInstallment(m: MovementResponse): number {
    const start = parseDate(m.date);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    return Math.min(Math.max(elapsed, 1), m.loanInstallments ?? 1);
  }

  ngOnInit() {
    this.api
      .getInstallments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.installments.set(list), error: () => {} });
    this.movForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.formAccountId.set(v.accountId ?? '');
      this.formCurrency.set(v.currency ?? 'ARS');
      this.formSourceType.set(v.sourceType ?? 'Cash');
      this.formType.set(v.type ?? 'Expense');
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
        },
      });
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
    const patches: Record<string, unknown> = {
      sourceType: source,
      accountId: '',
      loanInstallments: null,
      loanInterestRate: null,
    };
    if (source !== 'Loan') patches['loanParty'] = '';
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
    const filters: { currency?: string; categoryId?: string; accountId?: string } = {};
    if (this.filterCcy) filters.currency = this.filterCcy;
    if (this.filterCat) filters.categoryId = this.filterCat;
    if (this.filterAcc) filters.accountId = this.filterAcc;
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
      loanParty: m.loanParty ?? '',
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
    // La cuenta predeterminada del usuario precarga origen, cuenta y moneda
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
      loanParty: '',
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

  closeModal() {
    this.showModal.set(false);
    this.editingMovement.set(null);
  }

  save() {
    this.movForm.markAllAsTouched();
    if (this.movForm.invalid) return;
    this.saving.set(true);
    const v = this.movForm.value;

    let subType: string | undefined;
    if (v.sourceType === 'Loan' && v.type === 'Income') subType = 'LoanReceived';
    if (v.sourceType === 'Loan' && v.type === 'Expense') subType = 'LoanGiven';

    const req = {
      type: v.type!,
      subType,
      sourceType: v.sourceType || undefined,
      loanParty: v.loanParty || undefined,
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
    const op = editing ? this.api.updateMovement(editing.id, req) : this.api.createMovement(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        // Si es compra nueva con tarjeta y cuotas > 1, crear InstallmentPurchase
        const cuotas = v.loanInstallments;
        const accountId = v.accountId;
        if (!editing && v.sourceType === 'CreditCard' && cuotas && cuotas > 1 && accountId) {
          const dateStr = v.date ? v.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
          this.api
            .createInstallment({
              description: v.description || 'Compra en cuotas',
              accountId,
              totalAmount: (v.amount ?? 0) * cuotas,
              currency: v.currency!,
              trmApplied: v.trmApplied ?? 1,
              installmentsCount: cuotas,
              paidCount: 0,
              startDate: dateStr,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: () => {}, error: () => {} });
        }
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
