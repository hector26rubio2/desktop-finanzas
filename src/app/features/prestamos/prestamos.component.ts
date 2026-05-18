import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, LoanResponse, AccountResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

interface AmortRow {
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="view">
      <div class="row-flex">
        <h3 class="serif" style="font-size:22px;font-weight:400;flex:1">{{ i18n.t('prestamos.title') }}</h3>
        <button class="btn btn--primary" (click)="showForm = !showForm">{{ i18n.t('prestamos.nuevo') }}</button>
      </div>

      @if (showForm) {
        <div class="card" style="padding:var(--pad-x)">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <label style="grid-column:1/-1">
                {{ i18n.t('prestamos.descripcion') }}
                <input formControlName="description" placeholder="{{ i18n.t('prestamos.descripcion_placeholder') }}" />
              </label>
              <label>
                {{ i18n.t('prestamos.contraparte') }}
                <input formControlName="party" placeholder="{{ i18n.t('cuentas.banco_placeholder') }}" />
              </label>
              <label>
                {{ i18n.t('prestamos.capital') }}
                <input type="number" formControlName="principal" min="1" />
              </label>
              <label>
                {{ i18n.t('prestamos.moneda') }}
                <select formControlName="currency">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>
                {{ i18n.t('prestamos.trm') }}
                <input type="number" formControlName="trmApplied" min="0.000001" step="0.01" />
              </label>
              <label>
                {{ i18n.t('prestamos.tea') }}
                <input type="number" formControlName="interestRateAnnual" min="0" step="0.01" />
              </label>
              <label>
                {{ i18n.t('prestamos.plazo') }}
                <input type="number" formControlName="termMonths" min="1" max="600" />
              </label>
              <label>
                {{ i18n.t('prestamos.tipo_amortizacion') }}
                <select formControlName="loanType">
                  <option value="French">{{ i18n.t('prestamos.frances') }}</option>
                  <option value="German">{{ i18n.t('prestamos.aleman') }}</option>
                  <option value="American">{{ i18n.t('prestamos.americano') }}</option>
                </select>
              </label>
              <label>
                {{ i18n.t('prestamos.fecha_inicio') }}
                <input type="date" formControlName="startDate" />
              </label>
              <label>
                {{ i18n.t('prestamos.cuenta_asociada') }}
                <select formControlName="accountId">
                  <option value="">{{ i18n.t('prestamos.ninguna') }}</option>
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </label>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
              <button type="button" class="btn btn--ghost" (click)="showForm = false">
                {{ i18n.t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving()">
                {{ saving() ? '…' : i18n.t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="empty-state">
          <p>{{ i18n.t('prestamos.cargando') }}</p>
        </div>
      } @else if (loans().length === 0) {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('prestamos.sin_prestamos') }}</div>
          <p>{{ i18n.t('prestamos.sin_prestamos_desc') }}</p>
        </div>
      } @else {
        <div style="display:grid;grid-template-columns:280px 1fr;gap:var(--gutter);align-items:start">
          <div style="display:flex;flex-direction:column;gap:8px">
            @for (loan of loans(); track loan.id) {
              <div
                class="card"
                style="padding:14px;cursor:pointer;transition:border-color .15s;border:2px solid"
                [style.border-color]="selectedId() === loan.id ? 'var(--accent)' : 'transparent'"
                (click)="selectedId.set(loan.id)"
              >
                <div style="font-weight:500;color:var(--fg-0);margin-bottom:4px">{{ loan.description }}</div>
                @if (loan.party) {
                  <div class="subtle" style="font-size:11px;margin-bottom:6px">{{ loan.party }}</div>
                }
                <div class="progress" style="margin-bottom:6px">
                  <div class="progress__fill" [style.width]="progressPct(loan) + '%'"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span class="mono" style="font-size:11px;color:var(--fg-2)"
                    >{{ loan.paidMonths }}/{{ loan.termMonths }} meses</span
                  >
                  <span class="mono" style="font-size:12px;color:var(--negative)"
                    >{{ loan.currency }} {{ monthlyPayment(loan) | number: '1.0-0' }}/mes</span
                  >
                </div>
                <div style="margin-top:6px;display:flex;gap:6px">
                  <span class="tag tag--accent" style="font-size:10px">{{ loan.loanType.toUpperCase() }}</span>
                  <span class="tag" style="font-size:10px"
                    >TEA {{ loan.interestRateAnnual * 100 | number: '1.0-1' }}%</span
                  >
                </div>
              </div>
            }
          </div>

          @if (selected()) {
            @let loan = selected()!;
            <div>
              <div class="kpi-grid" style="margin-bottom:var(--gutter)">
                <div class="kpi-card">
                  <div class="eyebrow">{{ i18n.t('prestamos.label_capital') }}</div>
                  <div class="num-sm" style="margin-top:6px">
                    {{ loan.currency }} {{ loan.principal | number: '1.0-0' }}
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="eyebrow">{{ i18n.t('prestamos.cuota_mensual') }}</div>
                  <div class="num-sm" style="margin-top:6px;color:var(--negative)">
                    {{ loan.currency }} {{ monthlyPayment(loan) | number: '1.0-0' }}
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="eyebrow">{{ i18n.t('prestamos.total_intereses') }}</div>
                  <div class="num-sm" style="margin-top:6px;color:var(--warning)">
                    {{ loan.currency }} {{ totalInterest(loan) | number: '1.0-0' }}
                  </div>
                </div>
                <div class="kpi-card">
                  <div class="eyebrow">{{ i18n.t('prestamos.meses_restantes') }}</div>
                  <div class="num-sm" style="margin-top:6px">{{ loan.remainingMonths }}</div>
                </div>
              </div>

              <div class="card" style="padding:0;overflow:hidden">
                <div class="card__h">
                  <span class="card__title">{{ i18n.t('prestamos.cuadro_amortizacion') }} {{ loan.loanType }}</span>
                  <button class="btn btn--ghost btn--icon" style="color:var(--negative)" (click)="deleteLoan(loan.id)">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    >
                      <path d="M3 4h10M6 2h4M5 4v9h6V4" />
                    </svg>
                  </button>
                </div>
                <div style="max-height:400px;overflow-y:auto">
                  <table class="table">
                    <thead>
                      <tr>
                        <th style="width:40px">{{ i18n.t('prestamos.table_numero') }}</th>
                        <th class="num">{{ i18n.t('prestamos.table_cuota') }}</th>
                        <th class="num">{{ i18n.t('prestamos.table_interes') }}</th>
                        <th class="num">{{ i18n.t('prestamos.table_capital') }}</th>
                        <th class="num">{{ i18n.t('prestamos.table_saldo') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of amortTable(); track row.n) {
                        <tr
                          [style.opacity]="row.n <= loan.paidMonths ? '0.45' : '1'"
                          [style.background]="row.n === loan.paidMonths + 1 ? 'var(--accent-soft)' : ''"
                        >
                          <td class="mono" style="font-size:11px;color:var(--fg-2)">{{ row.n }}</td>
                          <td class="num mono">{{ row.payment | number: '1.0-0' }}</td>
                          <td class="num mono" style="color:var(--warning)">{{ row.interest | number: '1.0-0' }}</td>
                          <td class="num mono" style="color:var(--positive)">{{ row.principal | number: '1.0-0' }}</td>
                          <td class="num mono">{{ row.balance | number: '1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PrestamosComponent implements OnInit {
  loans = signal<LoanResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = false;
  selectedId = signal<string | null>(null);

  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  selected = () => this.loans().find((l) => l.id === this.selectedId()) ?? null;

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
    this.api.getLoans().subscribe({
      next: (list) => {
        this.loans.set(list);
        if (list.length) this.selectedId.set(list[0].id);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getAccounts().subscribe((list) => this.accounts.set(list));
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
    this.api.deleteLoan(id).subscribe(() => {
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
    const im = interestRateAnnual / 12;
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
