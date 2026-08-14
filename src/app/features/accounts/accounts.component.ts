import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, AccountResponse, AccountRequest, AccountBalance } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { CatIconComponent } from '@ui/atoms/cat-icon/cat-icon.component';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { resolveViewLoadState } from '../../shared/utils/view-load-state';

type AccTpl = TemplateRef<{ $implicit: AccountResponse; row: AccountResponse }>;

@Component({
  selector: 'app-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ConfirmDialogComponent,
    CatIconComponent,
    DataTableComponent,
  ],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  accounts = signal<AccountResponse[]>([]);
  balances = signal<Record<string, AccountBalance>>({});
  loading = signal(true);
  loadError = signal(false);
  loadState = computed(() => resolveViewLoadState(this.loading(), this.loadError(), this.accounts().length));
  saving = signal(false);
  showModal = signal(false);
  showDeleteModal = signal(false);
  deleting = signal<AccountResponse | null>(null);
  editing = signal<AccountResponse | null>(null);
  filterType = signal<'' | 'Cash' | 'Debit' | 'Credit'>('');
  searchQuery = signal('');

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const ft = this.filterType();
    return this.accounts().filter((a) => {
      if (ft && a.type !== ft) return false;
      if (q && !a.name.toLowerCase().includes(q) && !(a.bank ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  pageSize = signal(10);
  page = signal(1);
  pageSizes = [10, 20, 50];
  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()) || 1);
  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  rowCount = computed(() => this.filtered().length);

  iconCell = viewChild<AccTpl>('iconCell');
  nameCell = viewChild<AccTpl>('nameCell');
  bankCell = viewChild<AccTpl>('bankCell');
  typeCell = viewChild<AccTpl>('typeCell');
  currencyCell = viewChild<AccTpl>('currencyCell');
  balanceCell = viewChild<AccTpl>('balanceCell');
  detailCell = viewChild<AccTpl>('detailCell');
  actionsCell = viewChild<AccTpl>('actionsCell');

  trackById = (a: AccountResponse) => a.id;

  cols = computed<ColumnDef<AccountResponse>[]>(() => [
    { key: 'isDefault', header: '', width: '32px', cellTpl: this.iconCell() },
    { key: 'name', header: this.i18n.t('accounts.table_cuenta'), cellTpl: this.nameCell() },
    { key: 'bank', header: this.i18n.t('accounts.table_banco'), cellTpl: this.bankCell() },
    { key: 'type', header: this.i18n.t('accounts.table_tipo'), cellTpl: this.typeCell() },
    { key: 'currency', header: this.i18n.t('accounts.table_moneda'), width: '60px', cellTpl: this.currencyCell() },
    {
      key: 'creditLimit',
      header: this.i18n.t('accounts.table_saldo'),
      numeric: true,
      cellTpl: this.balanceCell(),
    },
    { key: 'billingDay', header: this.i18n.t('accounts.table_detalle'), numeric: true, cellTpl: this.detailCell() },
    { key: 'id', header: '', width: '70px', cellTpl: this.actionsCell() },
  ]);

  form = this.fb.group({
    name: ['', Validators.required],
    type: ['Debit' as 'Cash' | 'Debit' | 'Credit', Validators.required],
    currency: ['ARS', Validators.required],
    bank: [''],
    lastFour: [''],
    creditLimit: [null as number | null],
    billingDay: [null as number | null],
    paymentDay: [null as number | null],
    interestRate: [null as number | null],
  });

  get isNotCash(): boolean {
    return this.form.value.type !== 'Cash';
  }

  get isCreditType(): boolean {
    return this.form.value.type === 'Credit';
  }

  typeTagClass(type: string): string {
    if (type === 'Credit') return 'tag tag--negative';
    if (type === 'Debit') return 'tag tag--accent';
    return 'tag tag--info';
  }

  typeLabel(t: string): string {
    return t === 'Cash'
      ? this.i18n.t('accounts.tipo_efectivo')
      : t === 'Debit'
        ? this.i18n.t('accounts.tipo_debito')
        : this.i18n.t('accounts.tipo_credito');
  }

  setFilter(type: '' | 'Cash' | 'Debit' | 'Credit') {
    this.filterType.set(type);
    this.page.set(1);
  }

  onSearch(q: string) {
    this.searchQuery.set(q);
    this.page.set(1);
  }

  onPageChange(p: number) {
    this.page.set(p);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.accounts.set(list);
          if (list.length === 0) {
            this.balances.set({});
            this.loading.set(false);
            return;
          }
          this.api
            .getAccountBalances(list.map((a) => a.id))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (map) => {
                this.balances.set(map);
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

  retry() {
    this.load();
  }

  balanceOf(a: AccountResponse): number | null {
    const b = this.balances()[a.id];
    if (!b) return null;
    return a.type === 'Credit' ? (a.creditLimit ?? 0) - (b.outstandingDebt ?? b.usedInCycle) : b.balance;
  }

  accountIcon(a: AccountResponse): string {
    if (a.type === 'Cash') return 'hand-coins';
    if (a.type === 'Credit') return 'circle-dollar-sign';
    return 'landmark';
  }

  setDefault(a: AccountResponse) {
    if (a.isDefault) return;
    const req: AccountRequest = {
      name: a.name,
      type: a.type,
      currency: a.currency,
      bank: a.bank ?? undefined,
      lastFour: a.lastFour ?? undefined,
      creditLimit: a.creditLimit ?? undefined,
      billingDay: a.billingDay ?? undefined,
      paymentDay: a.paymentDay ?? undefined,
      interestRate: a.interestRate ?? undefined,
      isDefault: true,
    };
    this.api
      .updateAccount(a.id, req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  openCreate() {
    this.editing.set(null);
    this.form.reset({ type: 'Debit', currency: 'ARS' });
    this.showModal.set(true);
  }

  openEdit(a: AccountResponse) {
    this.editing.set(a);
    this.form.patchValue({
      name: a.name,
      type: a.type,
      currency: a.currency,
      bank: a.bank ?? '',
      lastFour: a.lastFour ?? '',
      creditLimit: a.creditLimit,
      billingDay: a.billingDay,
      paymentDay: a.paymentDay,
      interestRate: a.interestRate,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editing.set(null);
  }

  onTypeChange() {
    if (this.form.value.type !== 'Credit')
      this.form.patchValue({ creditLimit: null, billingDay: null, paymentDay: null, interestRate: null });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const editingAcc = this.editing();
    const req: AccountRequest = {
      name: v.name!,
      type: v.type!,
      currency: v.currency!,
      bank: v.bank || undefined,
      lastFour: v.lastFour || undefined,
      creditLimit: v.creditLimit ?? undefined,
      billingDay: v.billingDay ?? undefined,
      paymentDay: v.paymentDay ?? undefined,
      interestRate: v.interestRate ?? undefined,
      isDefault: editingAcc?.isDefault ?? false,
    };
    const op = editingAcc ? this.api.updateAccount(editingAcc!.id, req) : this.api.createAccount(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.editing.set(null);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  askRemove(a: AccountResponse) {
    this.showModal.set(false);
    this.editing.set(null);
    this.deleting.set(a);
    this.showDeleteModal.set(true);
  }

  confirmRemove() {
    const a = this.deleting();
    if (!a) return;
    this.showDeleteModal.set(false);
    this.api
      .deleteAccount(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.deleting.set(null);
        this.load();
      });
  }

  cancelRemove() {
    this.showDeleteModal.set(false);
    this.deleting.set(null);
  }
}
