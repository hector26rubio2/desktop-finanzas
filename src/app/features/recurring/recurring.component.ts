import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatNumber } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  ApiService,
  type RecurringTransactionResponse,
  type AccountResponse,
  type CategoryResponse,
} from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { toDateKey } from '../../shared/utils/date';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { FieldErrorComponent } from '@ui/atoms/field-error/field-error.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { forkJoin } from 'rxjs';
import { resolveViewLoadState } from '../../shared/utils/view-load-state';

@Component({
  selector: 'app-recurring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, FieldErrorComponent, KpiStripComponent],
  templateUrl: './recurring.component.html',
  styleUrl: './recurring.component.css',
})
export class RecurringComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);

  items = signal<RecurringTransactionResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  categories = signal<CategoryResponse[]>([]);
  loading = signal(true);
  loadError = signal(false);
  loadState = computed(() => resolveViewLoadState(this.loading(), this.loadError(), this.items().length));
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    type: ['Expense' as 'Income' | 'Expense', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['COP', Validators.required],
    trmApplied: [1],
    categoryId: [''],
    accountId: [''],
    description: [''],
    frequency: ['Monthly' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly', Validators.required],
    interval: [1, [Validators.required, Validators.min(1)]],
    dayOfMonth: [null as number | null, [Validators.min(1), Validators.max(31)]],
    startDate: ['', Validators.required],
    endDate: [''],
  });

  ngOnInit() {
    this.reload();
  }

  private reload() {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      items: this.api.getRecurring(),
      accounts: this.api.getAccounts(),
      categories: this.api.getCategories(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, accounts, categories }) => {
          this.items.set(items);
          this.accounts.set(accounts);
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  retry() {
    this.reload();
  }

  openCreate() {
    const today = toDateKey(new Date());
    this.editingId.set(null);
    this.form.reset({
      type: 'Expense',
      amount: null,
      currency: this.auth.baseCurrency(),
      trmApplied: 1,
      categoryId: '',
      accountId: '',
      description: '',
      frequency: 'Monthly',
      interval: 1,
      dayOfMonth: new Date().getDate(),
      startDate: today,
      endDate: '',
    });
    this.showForm.set(true);
  }

  onTypeChange() {
    const category = this.categories().find((item) => item.id === this.form.value.categoryId);
    if (category && category.type !== this.form.value.type) this.form.patchValue({ categoryId: '' });
  }

  onCurrencyChange() {
    const account = this.accounts().find((item) => item.id === this.form.value.accountId);
    if (account && account.currency !== this.form.value.currency) this.form.patchValue({ accountId: '' });
  }

  openEdit(item: RecurringTransactionResponse) {
    this.editingId.set(item.id);
    this.form.reset({
      type: item.type,
      amount: item.amount,
      currency: item.currency,
      trmApplied: item.trmApplied,
      categoryId: item.categoryId ?? '',
      accountId: item.accountId ?? '',
      description: item.description ?? '',
      frequency: item.frequency,
      interval: item.interval,
      dayOfMonth: item.dayOfMonth,
      startDate: item.startDate,
      endDate: item.endDate ?? '',
    });
    this.showForm.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const req = {
      type: v.type!,
      amount: v.amount!,
      currency: v.currency!,
      trmApplied: v.trmApplied ?? 1,
      categoryId: v.categoryId || undefined,
      accountId: v.accountId || undefined,
      description: v.description || undefined,
      frequency: v.frequency!,
      interval: v.interval ?? 1,
      dayOfMonth: v.frequency === 'Monthly' ? (v.dayOfMonth ?? undefined) : undefined,
      startDate: v.startDate!,
      endDate: v.endDate || undefined,
    };
    const id = this.editingId();
    const op = id ? this.api.updateRecurring(id, req) : this.api.createRecurring(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  toggle(item: RecurringTransactionResponse) {
    this.api
      .toggleRecurringActive(item.id, !item.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => this.items.update((l) => l.map((i) => (i.id === updated.id ? updated : i))));
  }

  remove(id: string) {
    this.api
      .deleteRecurring(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.items.update((l) => l.filter((i) => i.id !== id)));
  }

  freqLabel(f: string): string {
    return this.i18n.t(`recurring.freq_${f.toLowerCase()}`);
  }

  kpiItems(): KpiStripItem[] {
    const fmt = (v: number) => formatNumber(v, 'en-US', '1.0-0');
    const active = this.items().filter((i) => i.isActive);
    const expense = active.filter((i) => i.type === 'Expense').reduce((s, i) => s + i.amount, 0);
    const income = active.filter((i) => i.type === 'Income').reduce((s, i) => s + i.amount, 0);
    return [
      { label: this.i18n.t('recurring.kpi_active'), value: '' + active.length },
      { label: this.i18n.t('recurring.kpi_expense'), value: fmt(expense), color: 'var(--negative)' },
      { label: this.i18n.t('recurring.kpi_income'), value: fmt(income), color: 'var(--positive)' },
    ];
  }
}
