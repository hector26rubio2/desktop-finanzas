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
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.css',
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
    if (!confirm(this.i18n.t('transactions.delete_confirm'))) return;
    this.api.deleteMovement(id).subscribe(() => this.loadPage(this.currentPage()));
  }

  subTypeLabel(st: string): string {
    const map: Record<string, string> = {
      Income: this.i18n.t('transactions.income'),
      Expense: this.i18n.t('transactions.expense'),
      LoanReceived: this.i18n.t('transactions.loan_received'),
      LoanGiven: this.i18n.t('transactions.loan_given'),
      Saving: this.i18n.t('transactions.saving'),
    };
    return map[st] ?? st;
  }
}

