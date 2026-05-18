import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  ApiService,
  MovementResponse,
  CategoryResponse,
  AccountResponse,
  PagedResult,
} from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/services/i18n.service';
import { ThemeService } from '../shared/services/theme.service';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="layout">
      <header>
        <h2>{{ i18n.t('movements') }}</h2>
        <div class="header-right">
          <button (click)="router.navigate(['/dashboard'])">📊</button>
          <button (click)="router.navigate(['/accounts'])">{{ i18n.t('accounts') }}</button>
          @if (isAdmin()) {
            <button (click)="router.navigate(['/admin'])">{{ i18n.t('admin') }}</button>
          }
          <button (click)="i18n.toggle()">{{ i18n.lang() === 'es' ? 'EN' : 'ES' }}</button>
          <button (click)="theme.toggle()">{{ theme.isDarkTheme() ? '☀️' : '🌙' }}</button>
          <button class="danger" (click)="auth.logout()">{{ i18n.t('logout') }}</button>
        </div>
      </header>

      <!-- Month nav -->
      <div class="month-bar">
        <input type="month" [value]="currentMonth()" (change)="onMonthChange($event)" />
        <button class="primary" (click)="showForm = !showForm">+ {{ i18n.t('newMovement') }}</button>
      </div>

      <!-- Summary -->
      @if (summary()) {
        <div class="summary-bar">
          <span class="income">{{ i18n.t('totalIncome') }}: {{ summary()!.totalIncome | number: '1.0-0' }}</span>
          <span class="expense">{{ i18n.t('totalExpense') }}: {{ summary()!.totalExpense | number: '1.0-0' }}</span>
          <span
            >{{ i18n.t('balance') }}: <strong>{{ summary()!.balance | number: '1.0-0' }}</strong></span
          >
        </div>
      }

      <!-- New movement form -->
      @if (showForm) {
        <div class="form-card">
          <h3>{{ i18n.t('newMovement') }}</h3>
          <form [formGroup]="movForm" (ngSubmit)="createMovement()">
            <div class="row">
              <label>
                {{ i18n.t('type') }}
                <select formControlName="type">
                  <option value="Expense">{{ i18n.t('expense') }}</option>
                  <option value="Income">{{ i18n.t('income') }}</option>
                </select>
              </label>
              <label>
                {{ i18n.t('subType') }}
                <select formControlName="subType">
                  <option value="">—</option>
                  <option value="Income">{{ i18n.t('income') }}</option>
                  <option value="Expense">{{ i18n.t('expense') }}</option>
                  <option value="LoanReceived">{{ i18n.t('loanReceived') }}</option>
                  <option value="LoanGiven">{{ i18n.t('loanGiven') }}</option>
                  <option value="Saving">{{ i18n.t('savingSubtype') }}</option>
                </select>
              </label>
              <label>
                {{ i18n.t('sourceType') }}
                <select formControlName="sourceType" (change)="onSourceTypeChange()">
                  <option value="">—</option>
                  <option value="Cash">{{ i18n.t('cash') }}</option>
                  <option value="OwnAccount">{{ i18n.t('ownAccount') }}</option>
                  <option value="CreditCard">{{ i18n.t('creditCard') }}</option>
                  <option value="Loan">{{ i18n.t('loan') }}</option>
                </select>
              </label>
              @if (showLoanParty) {
                <label>
                  {{ i18n.t('loanParty') }}
                  <input formControlName="loanParty" placeholder="Nombre..." />
                </label>
              }
            </div>
            <div class="row">
              <label>
                {{ i18n.t('amount') }}
                <input type="number" formControlName="amount" min="0.01" step="0.01" />
              </label>
              <label>
                {{ i18n.t('currency') }}
                <select formControlName="currency">
                  <option>COP</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
              @if (movForm.value.currency !== 'COP') {
                <label>
                  TRM
                  <input type="number" formControlName="trmApplied" min="0.000001" step="1" />
                </label>
              }
              <label>
                {{ i18n.t('date') }}
                <input type="date" formControlName="date" />
              </label>
            </div>
            <div class="row">
              <label>
                {{ i18n.t('category') }}
                <select formControlName="categoryId">
                  <option value="">{{ i18n.t('noCategory') }}</option>
                  @for (c of categories(); track c) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </label>
              <label>
                {{ i18n.t('account') }}
                <select formControlName="accountId">
                  <option value="">{{ i18n.t('noAccount') }}</option>
                  @for (a of accounts(); track a) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </label>
              <label style="flex:2">
                {{ i18n.t('description') }}
                <input type="text" formControlName="description" />
              </label>
            </div>
            <div class="form-actions">
              <button type="button" (click)="showForm = false">{{ i18n.t('cancel') }}</button>
              <button type="submit" class="primary" [disabled]="movForm.invalid || saving">
                {{ saving ? i18n.t('savingLabel') : i18n.t('save') }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Table -->
      <div class="table-wrap">
        @if (!page()) {
          <div class="loading">{{ i18n.t('loading') }}</div>
        }
        @if (page()) {
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('date') }}</th>
                <th>{{ i18n.t('description') }}</th>
                <th>{{ i18n.t('subType') }}</th>
                <th>{{ i18n.t('category') }}</th>
                <th>{{ i18n.t('account') }}</th>
                <th>{{ i18n.t('amount') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of page()!.items; track m) {
                <tr [class]="m.type.toLowerCase()">
                  <td>{{ m.date }}</td>
                  <td>{{ m.description ?? '—' }}</td>
                  <td>
                    @if (m.subType) {
                      <span class="sub-badge">{{ subTypeLabel(m.subType) }}</span>
                    }
                    @if (!m.subType) {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>
                    <span class="cat-dot" [style.background]="m.categoryColor ?? 'var(--text-faint)'"></span>
                    {{ m.categoryName ?? '—' }}
                  </td>
                  <td>{{ m.accountName ?? '—' }}</td>
                  <td class="amount" [class.income]="m.type === 'Income'" [class.expense]="m.type === 'Expense'">
                    {{ m.type === 'Expense' ? '-' : '+' }}{{ m.amount | number: '1.2-2' }} {{ m.currency }}
                  </td>
                  <td><button class="icon-btn" (click)="deleteMovement(m.id)">✕</button></td>
                </tr>
              }
              @if (page()!.items.length === 0) {
                <tr>
                  <td colspan="7" class="empty">{{ i18n.t('noMovements') }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        @if (page() && page()!.total > page()!.pageSize) {
          <div class="pagination">
            <button [disabled]="currentPage() === 1" (click)="loadPage(currentPage() - 1)">‹</button>
            <span>{{ currentPage() }} / {{ totalPages }}</span>
            <button [disabled]="currentPage() >= totalPages" (click)="loadPage(currentPage() + 1)">›</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .month-bar {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 1rem;
      }
      .income td,
      tr.income td {
        background: color-mix(in srgb, var(--income) 5%, var(--bg));
      }
      .expense td,
      tr.expense td {
        background: color-mix(in srgb, var(--expense) 5%, var(--bg));
      }
      .cat-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
      }
      .amount {
        font-weight: 600;
      }
      .sub-badge {
        font-size: 0.72rem;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        background: var(--bg-subtle);
        color: var(--text-muted);
        border: 1px solid var(--border);
      }
      .muted {
        color: var(--text-faint);
      }
    `,
  ],
})
export class MovementsComponent implements OnInit {
  page = signal<PagedResult<MovementResponse> | null>(null);
  summary = signal<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);
  categories = signal<CategoryResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  currentMonth = signal(new Date().toISOString().slice(0, 7));
  currentPage = signal(1);
  showForm = false;
  saving = false;

  isAdmin = computed(() => this.auth.currentUser()?.role === 'Admin');

  get showLoanParty(): boolean {
    return this.movForm.value.sourceType === 'Loan';
  }

  movForm = this.fb.group({
    type: ['Expense' as 'Income' | 'Expense', Validators.required],
    subType: [''],
    sourceType: [''],
    loanParty: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['COP', Validators.required],
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

  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  public theme = inject(ThemeService);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  ngOnInit() {
    this.loadPage(1);
    this.api.getCategories().subscribe((cats) => this.categories.set(cats));
    this.api.getAccounts().subscribe((accs) => this.accounts.set(accs));
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
    if (this.movForm.value.sourceType !== 'Loan') {
      this.movForm.patchValue({ loanParty: '' });
    }
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
      Income: this.i18n.t('income'),
      Expense: this.i18n.t('expense'),
      LoanReceived: this.i18n.t('loanReceived'),
      LoanGiven: this.i18n.t('loanGiven'),
      Saving: this.i18n.t('savingSubtype'),
    };
    return map[st] ?? st;
  }
}
