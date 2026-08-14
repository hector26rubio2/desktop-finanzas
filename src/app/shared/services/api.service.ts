import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountsApiService } from './api/accounts-api.service';
import { MovementsApiService } from './api/movements-api.service';
import { CategoriesApiService } from './api/categories-api.service';
import { LoansApiService } from './api/loans-api.service';
import { InstallmentsApiService } from './api/installments-api.service';
import { RecurringTransactionsApiService } from './api/recurring-transactions-api.service';

import type { AccountResponse, AccountRequest, AccountBalance } from '../models/account.model';
import type { CategoryResponse } from '../models/category.model';
import type {
  MovementResponse,
  MovementRequest,
  MovementSummary,
  PagedResult,
  TransferRequest,
  TransferResponse,
  CreditCardPaymentRequest,
} from '../models/movement.model';
import type { LoanResponse, LoanRequest } from '../models/loan.model';
import type { InstallmentResponse, InstallmentRequest } from '../models/installment.model';
import type { RecurringTransactionResponse, RecurringTransactionRequest } from '../models/recurring-transaction.model';

export type {
  AccountResponse,
  AccountRequest,
  AccountBalance,
  CategoryResponse,
  MovementResponse,
  MovementRequest,
  MovementSummary,
  PagedResult,
  TransferRequest,
  TransferResponse,
  CreditCardPaymentRequest,
  LoanResponse,
  LoanRequest,
  InstallmentResponse,
  InstallmentRequest,
  RecurringTransactionResponse,
  RecurringTransactionRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private accountsApi = inject(AccountsApiService);
  private movementsApi = inject(MovementsApiService);
  private categoriesApi = inject(CategoriesApiService);
  private loansApi = inject(LoansApiService);
  private installmentsApi = inject(InstallmentsApiService);
  private recurringApi = inject(RecurringTransactionsApiService);

  // La autenticación ya no pasa por aquí: es local y va por IPC (LocalAuthService).

  // ── Accounts ──────────────────────────────────────────────────────────
  getAccounts(): Observable<AccountResponse[]> {
    return this.accountsApi.getAccounts();
  }
  createAccount(req: AccountRequest): Observable<AccountResponse> {
    return this.accountsApi.createAccount(req);
  }
  updateAccount(id: string, req: AccountRequest): Observable<AccountResponse> {
    return this.accountsApi.updateAccount(id, req);
  }
  deleteAccount(id: string): Observable<void> {
    return this.accountsApi.deleteAccount(id);
  }
  getAccountBalance(id: string): Observable<AccountBalance> {
    return this.accountsApi.getAccountBalance(id);
  }

  getAccountBalances(ids: string[]): Observable<Record<string, AccountBalance>> {
    return this.accountsApi.getAccountBalances(ids);
  }

  // ── Categories ────────────────────────────────────────────────────────
  getCategories(): Observable<CategoryResponse[]> {
    return this.categoriesApi.getCategories();
  }
  createCategory(req: {
    name: string;
    color: string;
    icon: string;
    type: 'Income' | 'Expense';
    translations?: import('../models/category.model').CategoryTranslations;
  }): Observable<CategoryResponse> {
    return this.categoriesApi.createCategory(req);
  }
  deleteCategory(id: string): Observable<void> {
    return this.categoriesApi.deleteCategory(id);
  }
  updateCategory(
    id: string,
    req: {
      name: string;
      color: string;
      icon: string;
      type: 'Income' | 'Expense';
      translations?: import('../models/category.model').CategoryTranslations;
    },
  ): Observable<CategoryResponse> {
    return this.categoriesApi.updateCategory(id, req);
  }

  // ── Movements ─────────────────────────────────────────────────────────
  getMovements(
    yearMonth: string,
    page = 1,
    pageSize = 20,
    filters?: {
      currency?: string;
      categoryId?: string;
      accountId?: string;
      type?: 'Income' | 'Expense';
      portfolioEntityId?: string;
      portfolioType?: string;
    },
  ): Observable<PagedResult<MovementResponse>> {
    return this.movementsApi.getMovements(yearMonth, page, pageSize, filters);
  }
  getMovementSummary(yearMonth: string): Observable<MovementSummary> {
    return this.movementsApi.getMovementSummary(yearMonth);
  }
  createMovement(req: MovementRequest): Observable<MovementResponse> {
    return this.movementsApi.createMovement(req);
  }
  createTransfer(req: TransferRequest, idempotencyKey: string): Observable<TransferResponse> {
    return this.movementsApi.createTransfer(req, idempotencyKey);
  }
  createCreditCardPayment(req: CreditCardPaymentRequest, idempotencyKey: string): Observable<TransferResponse> {
    return this.movementsApi.createCreditCardPayment(req, idempotencyKey);
  }
  deleteMovement(id: string): Observable<void> {
    return this.movementsApi.deleteMovement(id);
  }
  updateMovement(id: string, req: MovementRequest): Observable<MovementResponse> {
    return this.movementsApi.updateMovement(id, req);
  }

  // ── Loans ─────────────────────────────────────────────────────────────
  getLoans(): Observable<LoanResponse[]> {
    return this.loansApi.getLoans();
  }
  createLoan(req: LoanRequest): Observable<LoanResponse> {
    return this.loansApi.createLoan(req);
  }
  updateLoan(id: string, req: LoanRequest): Observable<LoanResponse> {
    return this.loansApi.updateLoan(id, req);
  }
  deleteLoan(id: string): Observable<void> {
    return this.loansApi.deleteLoan(id);
  }

  // ── Installments ──────────────────────────────────────────────────────
  getInstallments(): Observable<InstallmentResponse[]> {
    return this.installmentsApi.getInstallments();
  }
  createInstallment(req: InstallmentRequest): Observable<InstallmentResponse> {
    return this.installmentsApi.createInstallment(req);
  }
  updateInstallmentPaid(id: string, paidCount: number): Observable<InstallmentResponse> {
    return this.installmentsApi.updateInstallmentPaid(id, paidCount);
  }
  getLoanSchedule(id: string) {
    return this.loansApi.getSchedule(id);
  }
  payLoan(
    id: string,
    sourceAccountId: string,
    extraPrincipal: number,
    idempotencyKey: string,
  ): Observable<LoanResponse> {
    return this.loansApi.payLoan(id, sourceAccountId, extraPrincipal, idempotencyKey);
  }
  payInstallment(id: string, sourceAccountId: string, idempotencyKey: string): Observable<InstallmentResponse> {
    return this.installmentsApi.payInstallment(id, sourceAccountId, idempotencyKey);
  }
  deleteInstallment(id: string): Observable<void> {
    return this.installmentsApi.deleteInstallment(id);
  }

  // ── Recurring transactions ────────────────────────────────────────────
  getRecurring(): Observable<RecurringTransactionResponse[]> {
    return this.recurringApi.getRecurring();
  }
  createRecurring(req: RecurringTransactionRequest): Observable<RecurringTransactionResponse> {
    return this.recurringApi.createRecurring(req);
  }
  updateRecurring(id: string, req: RecurringTransactionRequest): Observable<RecurringTransactionResponse> {
    return this.recurringApi.updateRecurring(id, req);
  }
  toggleRecurringActive(id: string, isActive: boolean): Observable<RecurringTransactionResponse> {
    return this.recurringApi.toggleActive(id, isActive);
  }
  deleteRecurring(id: string): Observable<void> {
    return this.recurringApi.deleteRecurring(id);
  }
}
