import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthApiService } from './api/auth-api.service';
import { AccountsApiService } from './api/accounts-api.service';
import { MovementsApiService } from './api/movements-api.service';
import { CategoriesApiService } from './api/categories-api.service';
import { LoansApiService } from './api/loans-api.service';
import { InstallmentsApiService } from './api/installments-api.service';
import { AdminApiService } from './api/admin-api.service';

import type { AuthResponse } from '../models/auth.model';
import type { AccountResponse, AccountRequest, AccountBalance } from '../models/account.model';
import type { CategoryResponse } from '../models/category.model';
import type { MovementResponse, MovementRequest, MovementSummary, PagedResult } from '../models/movement.model';
import type { LoanResponse, LoanRequest } from '../models/loan.model';
import type { InstallmentResponse, InstallmentRequest } from '../models/installment.model';
import type { AdminUserDto } from '../models/admin.model';

export type {
  AuthResponse,
  AccountResponse,
  AccountRequest,
  AccountBalance,
  CategoryResponse,
  MovementResponse,
  MovementRequest,
  MovementSummary,
  PagedResult,
  LoanResponse,
  LoanRequest,
  InstallmentResponse,
  InstallmentRequest,
  AdminUserDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private authApi = inject(AuthApiService);
  private accountsApi = inject(AccountsApiService);
  private movementsApi = inject(MovementsApiService);
  private categoriesApi = inject(CategoriesApiService);
  private loansApi = inject(LoansApiService);
  private installmentsApi = inject(InstallmentsApiService);
  private adminApi = inject(AdminApiService);

  // ── Auth ──────────────────────────────────────────────────────────────
  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.authApi.loginWithGoogle(idToken);
  }
  register(name: string, email: string, password: string, baseCurrency: string): Observable<AuthResponse> {
    return this.authApi.register(name, email, password, baseCurrency);
  }
  login(email: string, password: string): Observable<AuthResponse> {
    return this.authApi.login(email, password);
  }
  refresh(refreshToken: string): Observable<AuthResponse> {
    return this.authApi.refresh(refreshToken);
  }
  logout(refreshToken: string): Observable<void> {
    return this.authApi.logout(refreshToken);
  }
  forgotPassword(email: string): Observable<void> {
    return this.authApi.forgotPassword(email);
  }
  resetPassword(token: string, password: string): Observable<void> {
    return this.authApi.resetPassword(token, password);
  }
  verifyEmail(token: string): Observable<void> {
    return this.authApi.verifyEmail(token);
  }
  resendVerification(email: string): Observable<void> {
    return this.authApi.resendVerification(email);
  }

  // ── Admin ─────────────────────────────────────────────────────────────
  getAdminUsers(): Observable<AdminUserDto[]> {
    return this.adminApi.getAdminUsers();
  }
  setUserRole(id: string, role: string): Observable<void> {
    return this.adminApi.setUserRole(id, role);
  }
  setUserActive(id: string, isActive: boolean): Observable<void> {
    return this.adminApi.setUserActive(id, isActive);
  }

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
    filters?: { currency?: string; categoryId?: string; accountId?: string },
  ): Observable<PagedResult<MovementResponse>> {
    return this.movementsApi.getMovements(yearMonth, page, pageSize, filters);
  }
  getMovementSummary(yearMonth: string): Observable<MovementSummary> {
    return this.movementsApi.getMovementSummary(yearMonth);
  }
  createMovement(req: MovementRequest): Observable<MovementResponse> {
    return this.movementsApi.createMovement(req);
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
  deleteInstallment(id: string): Observable<void> {
    return this.installmentsApi.deleteInstallment(id);
  }
}
