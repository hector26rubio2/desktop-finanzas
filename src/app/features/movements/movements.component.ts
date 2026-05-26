import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
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
import { CatIconComponent } from '../../shared/ui/cat-icon/cat-icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { FmtDatePipe } from '../../shared/pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../shared/utils/movement-labels';

@Component({
  selector: 'app-movements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FmtDatePipe, CatIconComponent, ModalComponent],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.css',
})
export class MovementsComponent implements OnInit, OnDestroy {
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
  private sub = new Subscription();

  baseCurrency = computed(() => this.auth.currentUser()?.baseCurrency ?? 'ARS');

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

  ngOnInit() {
    this.sub.add(
      this.movForm.valueChanges.subscribe((v) => {
        this.formAccountId.set(v.accountId ?? '');
        this.formCurrency.set(v.currency ?? 'ARS');
        this.formSourceType.set(v.sourceType ?? 'Cash');
        this.formType.set(v.type ?? 'Expense');
      }),
    );
    this.loadPage(1);
    this.api.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (c) => this.categories.set(c) });
    this.api.getAccounts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.accounts.set(a);
        a.forEach((acc) => {
          this.api.getAccountBalance(acc.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (b) => this.accountBalances.update((m) => ({ ...m, [acc.id]: b })),
          });
        });
      },
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
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
    this.api.getMovements(this.currentMonth(), p, this.pageSize(), filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.page.set(r),
    });
    this.api.getMovementSummary(this.currentMonth()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.summary.set(s),
    });
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.loadPage(1);
  }

  prevPage() {
    if (this.currentPage() > 1) this.loadPage(this.currentPage() - 1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.loadPage(this.currentPage() + 1);
  }

  onMonthChange(e: Event) {
    this.currentMonth.set((e.target as HTMLInputElement).value);
    this.loadPage(1);
  }

  openCreate() {
    this.movForm.reset({
      type: 'Expense',
      sourceType: 'Cash',
      loanParty: '',
      loanInstallments: null,
      loanInterestRate: null,
      amount: null,
      currency: 'ARS',
      trmApplied: 1,
      date: new Date().toISOString().slice(0, 16),
      description: '',
      categoryId: '',
      accountId: '',
    });
    this.formType.set('Expense');
    this.formSourceType.set('Cash');
    this.formAccountId.set('');
    this.formCurrency.set('ARS');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    this.movForm.markAllAsTouched();
    if (this.movForm.invalid) return;
    this.saving.set(true);
    const v = this.movForm.value;

    let subType: string | undefined;
    if (v.sourceType === 'Loan' && v.type === 'Income') subType = 'LoanReceived';
    if (v.sourceType === 'Loan' && v.type === 'Expense') subType = 'LoanGiven';

    this.api
      .createMovement({
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
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showModal.set(false);
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
    Promise.all(ids.map((id) => this.api.deleteMovement(id).toPromise())).then(() => {
      this.deletingIds.set([]);
      this.loadPage(this.currentPage());
    });
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deletingIds.set([]);
  }

  toggleAll() {
    const p = this.page();
    if (!p) return;
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

  rowCount(): number {
    return this.page()?.total ?? 0;
  }
}
