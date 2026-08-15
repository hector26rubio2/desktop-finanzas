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
import { CommonModule, formatNumber } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, LoanResponse, AccountResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { FieldErrorComponent } from '@ui/atoms/field-error/field-error.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { forkJoin } from 'rxjs';
import { resolveViewLoadState } from '../../shared/utils/view-load-state';
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { SkeletonComponent } from '@ui/atoms/skeleton/skeleton.component';

interface AmortRow {
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

type AmortTpl = TemplateRef<{ $implicit: AmortRow; row: AmortRow }>;

@Component({
  selector: 'app-loans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, FieldErrorComponent, KpiStripComponent, ConfirmDialogComponent, SkeletonComponent],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.css',
})
export class LoansComponent implements OnInit {
  loans = signal<LoanResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  loadError = signal(false);
  loadState = computed(() => resolveViewLoadState(this.loading(), this.loadError(), this.loans().length));
  saving = signal(false);
  showForm = false;
  selectedId = signal<string | null>(null);
  schedule = signal<AmortRow[]>([]);
  showPayment = signal(false);
  paymentSaving = signal(false);
  showDeleteModal = signal(false);
  deleting = signal<LoanResponse | null>(null);
  private paymentIdempotencyKey = '';

  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  private notif = inject(NotificationService);

  selected = () => this.loans().find((l) => l.id === this.selectedId()) ?? null;

  amortNCell = viewChild<AmortTpl>('amortNCell');
  amortPaymentCell = viewChild<AmortTpl>('amortPaymentCell');
  amortInterestCell = viewChild<AmortTpl>('amortInterestCell');
  amortPrincipalCell = viewChild<AmortTpl>('amortPrincipalCell');
  amortBalanceCell = viewChild<AmortTpl>('amortBalanceCell');

  trackByN = (r: AmortRow) => String(r.n);

  loanKpis(loan: LoanResponse): KpiStripItem[] {
    const fmt = (v: number) => loan.currency + ' ' + formatNumber(v, 'en-US', '1.0-0');
    return [
      { label: this.i18n.t('loans.label_capital'), value: fmt(loan.principal) },
      { label: this.i18n.t('loans.cuota_mensual'), value: fmt(this.monthlyPayment(loan)), color: 'var(--negative)' },
      { label: this.i18n.t('loans.total_intereses'), value: fmt(this.totalInterest(loan)), color: 'var(--warning)' },
      { label: this.i18n.t('loans.meses_restantes'), value: '' + loan.remainingMonths },
    ];
  }

  amortRowClass(loan: LoanResponse) {
    return (r: AmortRow) =>
      r.n <= loan.paidMonths ? 'dt-row--muted' : r.n === loan.paidMonths + 1 ? 'dt-row--active' : null;
  }

  amortCols = computed<ColumnDef<AmortRow>[]>(() => [
    { key: 'n', header: this.i18n.t('loans.table_numero'), width: '40px', cellTpl: this.amortNCell() },
    { key: 'payment', header: this.i18n.t('loans.table_cuota'), numeric: true, cellTpl: this.amortPaymentCell() },
    { key: 'interest', header: this.i18n.t('loans.table_interes'), numeric: true, cellTpl: this.amortInterestCell() },
    {
      key: 'principal',
      header: this.i18n.t('loans.table_capital'),
      numeric: true,
      cellTpl: this.amortPrincipalCell(),
    },
    { key: 'balance', header: this.i18n.t('loans.table_saldo'), numeric: true, cellTpl: this.amortBalanceCell() },
  ]);

  form = this.fb.group({
    description: ['', Validators.required],
    party: [''],
    principal: [null as number | null, [Validators.required, Validators.min(1)]],
    currency: ['ARS', Validators.required],
    trmApplied: [1],
    interestRateAnnual: [null as number | null, [Validators.required, Validators.min(0)]],
    termMonths: [null as number | null, [Validators.required, Validators.min(1)]],
    loanType: ['French'],
    startDate: ['', Validators.required],
    accountId: [''],
  });

  paymentForm = this.fb.group({
    sourceAccountId: ['', Validators.required],
    extraPrincipal: [0, Validators.min(0)],
  });

  openPayment(loan: LoanResponse) {
    const source = this.accounts().find((a) => a.type !== 'Credit' && a.isActive && a.currency === loan.currency);
    this.paymentForm.reset({ sourceAccountId: source?.id ?? '', extraPrincipal: 0 });
    this.paymentIdempotencyKey = crypto.randomUUID();
    this.showPayment.set(true);
  }

  closePayment() {
    if (!this.paymentSaving()) this.showPayment.set(false);
  }

  savePayment(loan: LoanResponse) {
    if (this.paymentSaving()) return;
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) return;
    const value = this.paymentForm.getRawValue();
    this.paymentSaving.set(true);
    this.api
      .payLoan(loan.id, value.sourceAccountId!, value.extraPrincipal ?? 0, this.paymentIdempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.loans.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
          this.paymentSaving.set(false);
          this.showPayment.set(false);
          this.selectLoan(updated.id);
        },
        error: () => this.paymentSaving.set(false),
      });
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
    forkJoin({ loans: this.api.getLoans(), accounts: this.api.getAccounts() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ loans, accounts }) => {
          this.loans.set(loans);
          this.accounts.set(accounts);
          if (loans.length) {
            this.selectLoan(loans[0].id);
          } else {
            this.selectedId.set(null);
            this.schedule.set([]);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  save() {

    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    this.api
      .createLoan({
        description: v.description!,
        party: v.party || undefined,
        principal: v.principal!,
        currency: v.currency!,
        trmApplied: v.trmApplied ?? 1,
        interestRateAnnual: v.interestRateAnnual!,
        termMonths: v.termMonths!,
        loanType: v.loanType as 'French' | 'German' | 'American',
        startDate: v.startDate!,
        accountId: v.accountId || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loan) => {
          this.loans.update((l) => [...l, loan]);
          this.selectLoan(loan.id);
          this.saving.set(false);
          this.showForm = false;
          this.form.reset({ currency: 'ARS', trmApplied: 1, loanType: 'French' });
        },
        error: () => this.saving.set(false),
      });
  }

  askDelete(loan: LoanResponse) {
    this.deleting.set(loan);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deleting.set(null);
  }

  confirmDelete() {
    const loan = this.deleting();
    if (!loan) return;
    this.showDeleteModal.set(false);
    this.api
      .deleteLoan(loan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loans.update((list) => list.filter((l) => l.id !== loan.id));
          if (this.selectedId() === loan.id) this.selectedId.set(this.loans()[0]?.id ?? null);
          this.deleting.set(null);
          this.notif.announce(this.i18n.t('loans.deleted'));
        },
        error: () => {
          this.deleting.set(null);
          this.notif.announce(this.i18n.t('common.load_error'));
        },
      });
  }

  progressPct(loan: LoanResponse) {
    return Math.min(100, Math.round((loan.paidMonths / loan.termMonths) * 100));
  }

  selectLoan(id: string) {
    this.selectedId.set(id);
    this.api
      .getLoanSchedule(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) =>
        this.schedule.set(
          rows.map((row) => ({
            n: row.number,
            payment: row.payment,
            interest: row.interest,
            principal: row.principal,
            balance: row.balance,
          })),
        ),
      );
  }

  monthlyPayment(loan: LoanResponse): number {
    return this.selectedId() === loan.id ? (this.schedule()[0]?.payment ?? 0) : 0;
  }

  totalInterest(loan: LoanResponse): number {
    return this.selectedId() === loan.id ? this.schedule().reduce((s, r) => s + r.interest, 0) : 0;
  }

  amortTable(): AmortRow[] {
    return this.schedule();
  }
}
