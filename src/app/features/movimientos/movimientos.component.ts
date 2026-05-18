import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  MovementResponse,
  CategoryResponse,
  AccountResponse,
  PagedResult,
} from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-movimientos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="view">
      <!-- KPI strip -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('header.movimientos') }}</div>
          <div class="num-md" style="margin-top:8px">{{ page()?.total ?? 0 }}</div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('mov.total_ingresos') }}</div>
          <div class="num-md" style="margin-top:8px;color:var(--positive)">
            + {{ summary()?.totalIncome ?? 0 | number: '1.0-0' }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('mov.total_gastos') }}</div>
          <div class="num-md" style="margin-top:8px;color:var(--negative)">
            − {{ summary()?.totalExpense ?? 0 | number: '1.0-0' }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('mov.balance_neto') }}</div>
          <div
            class="num-md"
            style="margin-top:8px"
            [style.color]="(summary()?.balance ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)'"
          >
            {{ (summary()?.balance ?? 0) >= 0 ? '+' : '−' }}{{ summary()?.balance ?? 0 | number: '1.0-0' }}
          </div>
        </div>
      </div>

      <!-- Filters bar -->
      <div class="card" style="padding:10px 12px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <!-- Search -->
          <div
            style="display:flex;align-items:center;gap:6px;background:var(--bg-2);border:1px solid var(--line-1);border-radius:var(--radius-input);padding:0 10px;flex:1;min-width:200px;height:32px"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M12 12l3 3" />
            </svg>
            <input
              [(ngModel)]="searchQ"
              (ngModelChange)="loadPage(1)"
              [placeholder]="i18n.t('mov.buscar')"
              style="background:none;border:0;outline:0;flex:1;color:var(--fg-0);font-size:12px;width:100%;padding:0"
            />
          </div>

          <input
            type="month"
            [value]="currentMonth()"
            (change)="onMonthChange($event)"
            style="width:150px;height:32px;padding:0 8px;font-size:12px"
          />

          <select
            [(ngModel)]="filterCcy"
            (ngModelChange)="loadPage(1)"
            style="width:90px;height:32px;padding:0 8px;font-size:12px"
          >
            <option value="">{{ i18n.t('mov.filtro_moneda') }}</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>

          <select
            [(ngModel)]="filterCat"
            (ngModelChange)="loadPage(1)"
            style="width:160px;height:32px;padding:0 8px;font-size:12px"
          >
            <option value="">{{ i18n.t('mov.filtro_categoria') }}</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>

          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn btn--ghost" style="font-size:11px" (click)="showForm = !showForm">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              >
                <path d="M8 1v14M1 8h14" />
              </svg>
              {{ i18n.t('mov.nuevo') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk bar -->
      @if (selected.size > 0) {
        <div
          class="card"
          style="padding:10px 14px;display:flex;gap:10px;align-items:center;background:var(--accent-soft);border-color:color-mix(in oklab,var(--accent) 40%,transparent)"
        >
          <span class="mono" style="font-size:12px;color:var(--accent)"
            >{{ selected.size }} {{ i18n.t('mov.selected') }}{{ selected.size > 1 ? 's' : '' }}</span
          >
          <button class="btn btn--ghost btn--danger" style="font-size:11px" (click)="deleteSelected()">
            {{ i18n.t('common.delete') }}
          </button>
          <button class="btn btn--ghost" style="font-size:11px;margin-left:auto" (click)="selected.clear()">
            {{ i18n.t('common.cancel') }}
          </button>
        </div>
      }

      <!-- New movement form -->
      @if (showForm) {
        <div class="card" style="padding:var(--pad-x)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h3 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:18px;font-weight:400">
              {{ i18n.t('mov.nuevo_title') }}
            </h3>
            <button class="btn btn--ghost btn--icon" (click)="showForm = false">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M1 1l14 14M15 1L1 15" />
              </svg>
            </button>
          </div>
          <form [formGroup]="movForm" (ngSubmit)="createMovement()">
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <label style="flex:1;min-width:120px">
                {{ i18n.t('mov.type') }}
                <select formControlName="type">
                  <option value="Expense">{{ i18n.t('mov.expense') }}</option>
                  <option value="Income">{{ i18n.t('mov.income') }}</option>
                </select>
              </label>
              <label style="flex:1;min-width:120px">
                {{ i18n.t('mov.subtype') }}
                <select formControlName="subType">
                  <option value="">—</option>
                  <option value="Income">{{ i18n.t('mov.income') }}</option>
                  <option value="Expense">{{ i18n.t('mov.expense') }}</option>
                  <option value="LoanReceived">{{ i18n.t('mov.loan_received') }}</option>
                  <option value="LoanGiven">{{ i18n.t('mov.loan_given') }}</option>
                  <option value="Saving">{{ i18n.t('mov.saving') }}</option>
                </select>
              </label>
              <label style="flex:1;min-width:120px">
                {{ i18n.t('mov.source') }}
                <select formControlName="sourceType" (change)="onSourceTypeChange()">
                  <option value="">—</option>
                  <option value="Cash">{{ i18n.t('mov.cash') }}</option>
                  <option value="OwnAccount">{{ i18n.t('mov.own_account') }}</option>
                  <option value="CreditCard">{{ i18n.t('mov.credit_card') }}</option>
                  <option value="Loan">{{ i18n.t('mov.loan') }}</option>
                </select>
              </label>
              @if (showLoanParty) {
                <label style="flex:1;min-width:120px">
                  {{ i18n.t('mov.lender') }}
                  <input formControlName="loanParty" [placeholder]="i18n.t('auth.name')" />
                </label>
              }
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <label style="flex:1;min-width:120px">
                {{ i18n.t('mov.amount') }}
                <input type="number" formControlName="amount" min="0.01" step="0.01" />
              </label>
              <label style="flex:1;min-width:100px">
                {{ i18n.t('mov.currency') }}
                <select formControlName="currency">
                  <option>ARS</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>COP</option>
                </select>
              </label>
              @if (movForm.value.currency !== 'ARS') {
                <label style="flex:1;min-width:100px">
                  {{ i18n.t('mov.trm') }}
                  <input type="number" formControlName="trmApplied" min="0.000001" step="1" />
                </label>
              }
              <label style="flex:1;min-width:130px">
                {{ i18n.t('mov.date') }}
                <input type="date" formControlName="date" />
              </label>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
              <label style="flex:1;min-width:140px">
                {{ i18n.t('mov.filtro_categoria') }}
                <select formControlName="categoryId">
                  <option value="">{{ i18n.t('mov.no_category') }}</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </label>
              <label style="flex:1;min-width:140px">
                {{ i18n.t('mov.table_cuenta') }}
                <select formControlName="accountId">
                  <option value="">{{ i18n.t('mov.no_account') }}</option>
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </label>
              <label style="flex:2;min-width:180px">
                {{ i18n.t('mov.table_concepto') }}
                <input
                  type="text"
                  formControlName="description"
                  [placeholder]="i18n.t('mov.description_placeholder')"
                />
              </label>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="btn btn--ghost" (click)="showForm = false">
                {{ i18n.t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn--primary" [disabled]="movForm.invalid || saving">
                {{ saving ? i18n.t('common.saving') : i18n.t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Table -->
      <div class="card" style="padding:0;overflow:hidden">
        @if (!page()) {
          <div class="empty-state" style="padding:60px">
            <div class="loading-dot" style="width:8px;height:8px;animation:pulse 1.2s infinite"></div>
          </div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th style="width:30px">
                  <input
                    type="checkbox"
                    [checked]="page()!.items.length > 0 && selected.size === page()!.items.length"
                    (change)="toggleAll()"
                    style="accent-color:var(--accent)"
                  />
                </th>
                <th style="width:90px">{{ i18n.t('mov.table_fecha') }}</th>
                <th>{{ i18n.t('mov.table_concepto') }}</th>
                <th style="width:150px">{{ i18n.t('mov.table_categoria') }}</th>
                <th style="width:160px">{{ i18n.t('mov.table_cuenta') }}</th>
                <th style="width:100px">{{ i18n.t('mov.table_tipo') }}</th>
                <th class="num" style="width:160px">{{ i18n.t('mov.table_monto') }}</th>
                <th style="width:30px"></th>
              </tr>
            </thead>
            <tbody>
              @for (m of page()!.items; track m.id) {
                <tr [style.background]="selected.has(m.id) ? 'var(--selected)' : ''">
                  <td>
                    <input
                      type="checkbox"
                      [checked]="selected.has(m.id)"
                      (change)="toggleSel(m.id)"
                      style="accent-color:var(--accent)"
                    />
                  </td>
                  <td class="mono subtle" style="font-size:11px;letter-spacing:.04em">{{ m.date }}</td>
                  <td>
                    <div style="color:var(--fg-0)">{{ m.description ?? '—' }}</div>
                    @if (m.subType) {
                      <div class="mono subtle" style="font-size:10px">{{ subTypeLabel(m.subType) }}</div>
                    }
                  </td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:6px">
                      @if (m.categoryColor) {
                        <span
                          style="width:7px;height:7px;border-radius:50%;flex-shrink:0"
                          [style.background]="m.categoryColor"
                        ></span>
                      }
                      {{ m.categoryName ?? '—' }}
                    </span>
                  </td>
                  <td class="muted" style="font-size:12px">{{ m.accountName ?? '—' }}</td>
                  <td>
                    <span class="tag" [class]="m.type === 'Income' ? 'tag--pos' : 'tag--neg'">
                      {{ m.type === 'Income' ? i18n.t('mov.ingreso_tag') : i18n.t('mov.gasto_tag') }}
                    </span>
                  </td>
                  <td class="num mono" [style.color]="m.type === 'Income' ? 'var(--positive)' : 'var(--fg-0)'">
                    {{ m.type === 'Income' ? '+' : '−' }}{{ m.amount | number: '1.2-2' }} {{ m.currency }}
                  </td>
                  <td>
                    <button
                      class="btn btn--ghost btn--icon"
                      (click)="deleteMovement(m.id)"
                      [title]="i18n.t('mov.delete_title')"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      >
                        <path d="M1 1l14 14M15 1L1 15" />
                      </svg>
                    </button>
                  </td>
                </tr>
              }
              @if (page()!.items.length === 0) {
                <tr>
                  <td colspan="8" class="empty-state" style="padding:60px;text-align:center">
                    <div class="serif" style="font-size:22px;font-style:italic;margin-bottom:6px">
                      {{ i18n.t('common.no_results') }}
                    </div>
                    <p>{{ i18n.t('common.empty_results') }}</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (page()!.total > page()!.pageSize) {
            <div
              style="display:flex;align-items:center;justify-content:center;gap:12px;padding:12px;border-top:1px solid var(--line)"
            >
              <button
                class="btn btn--ghost btn--icon"
                [disabled]="currentPage() === 1"
                (click)="loadPage(currentPage() - 1)"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <span class="mono" style="font-size:11px;color:var(--fg-2)">{{ currentPage() }} / {{ totalPages }}</span>
              <button
                class="btn btn--ghost btn--icon"
                [disabled]="currentPage() >= totalPages"
                (click)="loadPage(currentPage() + 1)"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class MovimientosComponent implements OnInit {
  page = signal<PagedResult<MovementResponse> | null>(null);
  summary = signal<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);
  categories = signal<CategoryResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  currentMonth = signal(new Date().toISOString().slice(0, 7));
  currentPage = signal(1);
  showForm = false;
  saving = false;
  searchQ = '';
  filterCcy = '';
  filterCat = '';
  selected = new Set<string>();

  public auth = inject(AuthService);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  movForm = this.fb.group({
    type: ['Expense' as 'Income' | 'Expense', Validators.required],
    subType: [''],
    sourceType: [''],
    loanParty: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['ARS', Validators.required],
    trmApplied: [1, Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    description: [''],
    categoryId: [''],
    accountId: [''],
  });

  get totalPages(): number {
    const p = this.page();
    return p ? Math.ceil(p.total / p.pageSize) : 1;
  }

  get showLoanParty(): boolean {
    return this.movForm.value.sourceType === 'Loan';
  }

  ngOnInit() {
    this.loadPage(1);
    this.api.getCategories().subscribe((c) => this.categories.set(c));
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
  }

  loadPage(p: number) {
    this.currentPage.set(p);
    this.api.getMovements(this.currentMonth(), p).subscribe((r) => this.page.set(r));
    this.api.getMovementSummary(this.currentMonth()).subscribe((s) => this.summary.set(s));
  }

  onMonthChange(e: Event) {
    this.currentMonth.set((e.target as HTMLInputElement).value);
    this.loadPage(1);
  }

  onSourceTypeChange() {
    if (this.movForm.value.sourceType !== 'Loan') this.movForm.patchValue({ loanParty: '' });
  }

  toggleAll() {
    if (!this.page()) return;
    if (this.selected.size === this.page()!.items.length) this.selected.clear();
    else this.page()!.items.forEach((m: { id: string }) => this.selected.add(m.id));
  }

  toggleSel(id: string) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  deleteSelected() {
    const ids = [...this.selected];
    Promise.all(ids.map((id) => this.api.deleteMovement(id).toPromise())).then(() => {
      this.selected.clear();
      this.loadPage(this.currentPage());
    });
  }

  createMovement() {
    this.movForm.markAllAsTouched();
    if (this.movForm.invalid) return;
    this.saving = true;
    const v = this.movForm.value;
    this.api
      .createMovement({
        type: v.type!,
        subType: v.subType || undefined,
        sourceType: v.sourceType || undefined,
        loanParty: v.loanParty || undefined,
        amount: v.amount!,
        currency: v.currency!,
        trmApplied: v.trmApplied ?? 1,
        date: v.date!,
        description: v.description || undefined,
        categoryId: v.categoryId || undefined,
        accountId: v.accountId || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.loadPage(this.currentPage());
        },
        error: () => {
          this.saving = false;
        },
      });
  }

  deleteMovement(id: string) {
    if (!confirm(this.i18n.t('mov.delete_confirm'))) return;
    this.api.deleteMovement(id).subscribe(() => this.loadPage(this.currentPage()));
  }

  subTypeLabel(st: string): string {
    const map: Record<string, string> = {
      Income: this.i18n.t('mov.income'),
      Expense: this.i18n.t('mov.expense'),
      LoanReceived: this.i18n.t('mov.loan_received'),
      LoanGiven: this.i18n.t('mov.loan_given'),
      Saving: this.i18n.t('mov.saving'),
    };
    return map[st] ?? st;
  }
}
