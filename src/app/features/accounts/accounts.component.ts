import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, AccountResponse, AccountRequest } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  editing = signal<AccountResponse | null>(null);
  showForm = false;

  arsTotal = () =>
    this.accounts()
      .filter((a) => a.currency === 'ARS')
      .reduce((s, _) => s, 0);

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

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAccounts().subscribe({
      next: (list) => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[accounts] load error:', err);
        this.loading.set(false);
      },
    });
  }

  openCreate() {
    this.editing.set(null);
    this.form.reset({ type: 'Debit', currency: 'ARS' });
    this.showForm = true;
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
    this.showForm = true;
  }

  cancelForm() {
    this.showForm = false;
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
    const op = this.editing() ? this.api.updateAccount(this.editing()!.id, req) : this.api.createAccount(req);
    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.editing.set(null);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(id: string) {
    if (!confirm(this.i18n.t('accounts.desactivar_confirm'))) return;
    this.api.deleteAccount(id).subscribe(() => this.load());
  }

  typeLabel(t: string): string {
    return t === 'Cash'
      ? this.i18n.t('accounts.tipo_efectivo')
      : t === 'Debit'
        ? this.i18n.t('accounts.tipo_debito')
        : this.i18n.t('accounts.tipo_credito');
  }
}
