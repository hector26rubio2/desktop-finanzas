import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, AccountResponse, AccountRequest } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.css',
})
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
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
  pageSizes = [5, 10, 15];
  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()) || 1);
  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

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

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  prevPage() {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  nextPage() {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getAccounts().subscribe({
      next: (list) => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
    };
    const editingAcc = this.editing();
    const op = editingAcc ? this.api.updateAccount(editingAcc!.id, req) : this.api.createAccount(req);
    op.subscribe({
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
    this.api.deleteAccount(a.id).subscribe(() => {
      this.deleting.set(null);
      this.load();
    });
  }

  cancelRemove() {
    this.showDeleteModal.set(false);
    this.deleting.set(null);
  }

  rowCount(): number {
    return this.filtered().length;
  }
}