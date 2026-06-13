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
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';

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
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, KpiStripComponent],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.css',
})
export class LoansComponent implements OnInit {
  loans = signal<LoanResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = false;
  selectedId = signal<string | null>(null);

  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

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

  ngOnInit() {
    this.api
      .getLoans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.loans.set(list);
          if (list.length) this.selectedId.set(list[0].id);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.api
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.accounts.set(list));
  }

  save() {
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
          this.selectedId.set(loan.id);
          this.saving.set(false);
          this.showForm = false;
          this.form.reset({ currency: 'ARS', trmApplied: 1, loanType: 'French' });
        },
        error: () => this.saving.set(false),
      });
  }

  deleteLoan(id: string) {
    this.api
      .deleteLoan(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loans.update((list) => list.filter((l) => l.id !== id));
        if (this.selectedId() === id) this.selectedId.set(this.loans()[0]?.id ?? null);
      });
  }

  progressPct(loan: LoanResponse) {
    return Math.min(100, Math.round((loan.paidMonths / loan.termMonths) * 100));
  }

  monthlyPayment(loan: LoanResponse): number {
    return this.buildAmort(loan)[0]?.payment ?? 0;
  }

  totalInterest(loan: LoanResponse): number {
    return this.buildAmort(loan).reduce((s, r) => s + r.interest, 0);
  }

  amortTable(): AmortRow[] {
    const l = this.selected();
    return l ? this.buildAmort(l) : [];
  }

  private buildAmort(loan: LoanResponse): AmortRow[] {
    const { principal, interestRateAnnual, termMonths, loanType } = loan;
    // interestRateAnnual es TEA en % (ej. 45 = 45%); tasa mensual efectiva equivalente
    const im = Math.pow(1 + interestRateAnnual / 100, 1 / 12) - 1;
    const rows: AmortRow[] = [];
    let balance = principal;

    if (loanType === 'French') {
      const pmt =
        im === 0
          ? principal / termMonths
          : (principal * im * Math.pow(1 + im, termMonths)) / (Math.pow(1 + im, termMonths) - 1);
      for (let n = 1; n <= termMonths; n++) {
        const interest = balance * im;
        const p = pmt - interest;
        balance -= p;
        rows.push({
          n,
          payment: +pmt.toFixed(2),
          interest: +interest.toFixed(2),
          principal: +p.toFixed(2),
          balance: Math.max(0, +balance.toFixed(2)),
        });
      }
    } else if (loanType === 'German') {
      const p = principal / termMonths;
      for (let n = 1; n <= termMonths; n++) {
        const interest = balance * im;
        rows.push({
          n,
          payment: +(p + interest).toFixed(2),
          interest: +interest.toFixed(2),
          principal: +p.toFixed(2),
          balance: Math.max(0, +(balance -= p).toFixed(2)),
        });
      }
    } else {
      const interest = balance * im;
      for (let n = 1; n <= termMonths; n++) {
        const isLast = n === termMonths;
        rows.push({
          n,
          payment: isLast ? +(balance + interest).toFixed(2) : +interest.toFixed(2),
          interest: +interest.toFixed(2),
          principal: isLast ? +balance.toFixed(2) : 0,
          balance: isLast ? 0 : balance,
        });
      }
    }
    return rows;
  }
}
