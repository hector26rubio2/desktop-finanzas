import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; baseCurrency: string; role: string };
}

export interface CategoryResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'Income' | 'Expense';
  isDefault: boolean;
  createdAt: string;
}

export interface MovementResponse {
  id: string;
  type: 'Income' | 'Expense';
  subType: 'Income' | 'Expense' | 'LoanReceived' | 'LoanGiven' | 'Saving' | null;
  sourceType: 'Cash' | 'OwnAccount' | 'CreditCard' | 'Loan' | null;
  loanParty: string | null;
  amount: number;
  currency: string;
  trmApplied: number;
  amountBase: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
  createdAt: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: 'User' | 'Admin';
  isActive: boolean;
  createdAt: string;
}

export interface AccountResponse {
  id: string;
  name: string;
  type: 'Cash' | 'Debit' | 'Credit';
  currency: string;
  bank: string | null;
  lastFour: string | null;
  creditLimit: number | null;
  billingDay: number | null;
  paymentDay: number | null;
  interestRate: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface AccountRequest {
  name: string;
  type: 'Cash' | 'Debit' | 'Credit';
  currency: string;
  bank?: string;
  lastFour?: string;
  creditLimit?: number;
  billingDay?: number;
  paymentDay?: number;
  interestRate?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  comparedToPreviousMonth: { incomeDelta: number; expenseDelta: number };
}

export interface MovementRequest {
  type: 'Income' | 'Expense';
  subType?: string;
  sourceType?: string;
  loanParty?: string;
  amount: number;
  currency: string;
  trmApplied: number;
  date: string;
  description?: string;
  categoryId?: string;
  accountId?: string;
}

export interface LoanResponse {
  id: string;
  userId: string;
  description: string;
  party: string | null;
  principal: number;
  currency: string;
  trmApplied: number;
  interestRateAnnual: number;
  termMonths: number;
  startDate: string;
  loanType: 'French' | 'German' | 'American';
  accountId: string | null;
  isActive: boolean;
  paidMonths: number;
  remainingMonths: number;
  createdAt: string;
}

export interface LoanRequest {
  description: string;
  party?: string;
  principal: number;
  currency: string;
  trmApplied?: number;
  interestRateAnnual: number;
  termMonths: number;
  startDate: string;
  loanType?: 'French' | 'German' | 'American';
  accountId?: string;
}

export interface InstallmentResponse {
  id: string;
  userId: string;
  description: string;
  accountId: string | null;
  totalAmount: number;
  currency: string;
  trmApplied: number;
  installmentsCount: number;
  paidCount: number;
  startDate: string;
  isActive: boolean;
  monthlyAmount: number;
  remainingAmount: number;
  createdAt: string;
}

export interface InstallmentRequest {
  description: string;
  accountId?: string;
  totalAmount: number;
  currency: string;
  trmApplied?: number;
  installmentsCount: number;
  paidCount?: number;
  startDate: string;
}

export interface AccountBalance {
  balance: number;
  usedInCycle: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // ── Auth ────────────────────────────────────────────────────────────────
  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/google`, { idToken });
  }

  register(name: string, email: string, password: string, baseCurrency: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, { name, email, password, baseCurrency });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password });
  }

  refresh(refreshToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, { refreshToken });
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  getAdminUsers(): Observable<AdminUserDto[]> {
    return this.http.get<AdminUserDto[]>(`${this.base}/admin/users`);
  }

  setUserRole(id: string, role: string): Observable<void> {
    return this.http.put<void>(`${this.base}/admin/users/${id}/role`, { role });
  }

  setUserActive(id: string, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/admin/users/${id}/active`, { isActive });
  }

  // ── Accounts ───────────────────────────────────────────────────────────
  getAccounts(): Observable<AccountResponse[]> {
    return this.http.get<AccountResponse[]>(`${this.base}/accounts`);
  }

  createAccount(req: AccountRequest): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(`${this.base}/accounts`, req);
  }

  updateAccount(id: string, req: AccountRequest): Observable<AccountResponse> {
    return this.http.put<AccountResponse>(`${this.base}/accounts/${id}`, req);
  }

  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/accounts/${id}`);
  }

  // ── Categories ─────────────────────────────────────────────────────────
  getCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(`${this.base}/categories`);
  }

  createCategory(req: { name: string; color: string }): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(`${this.base}/categories`, req);
  }

  // ── Movements ──────────────────────────────────────────────────────────
  getMovements(yearMonth: string, page = 1, pageSize = 20): Observable<PagedResult<MovementResponse>> {
    const [year, month] = yearMonth.split('-').map(Number);
    const params = new HttpParams().set('year', year).set('month', month).set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<MovementResponse>>(`${this.base}/movements`, { params });
  }

  getMovementSummary(yearMonth: string): Observable<MovementSummary> {
    const [year, month] = yearMonth.split('-').map(Number);
    return this.http.get<MovementSummary>(`${this.base}/movements/summary`, {
      params: new HttpParams().set('year', year).set('month', month),
    });
  }

  createMovement(req: MovementRequest): Observable<MovementResponse> {
    return this.http.post<MovementResponse>(`${this.base}/movements`, req);
  }

  deleteMovement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/movements/${id}`);
  }

  updateMovement(id: string, req: MovementRequest): Observable<MovementResponse> {
    return this.http.put<MovementResponse>(`${this.base}/movements/${id}`, req);
  }

  // ── Loans ──────────────────────────────────────────────────────────────
  getLoans(): Observable<LoanResponse[]> {
    return this.http.get<LoanResponse[]>(`${this.base}/loans`);
  }

  createLoan(req: LoanRequest): Observable<LoanResponse> {
    return this.http.post<LoanResponse>(`${this.base}/loans`, req);
  }

  updateLoan(id: string, req: LoanRequest): Observable<LoanResponse> {
    return this.http.put<LoanResponse>(`${this.base}/loans/${id}`, req);
  }

  deleteLoan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/loans/${id}`);
  }

  // ── Installments ───────────────────────────────────────────────────────
  getInstallments(): Observable<InstallmentResponse[]> {
    return this.http.get<InstallmentResponse[]>(`${this.base}/installments`);
  }

  createInstallment(req: InstallmentRequest): Observable<InstallmentResponse> {
    return this.http.post<InstallmentResponse>(`${this.base}/installments`, req);
  }

  updateInstallmentPaid(id: string, paidCount: number): Observable<InstallmentResponse> {
    return this.http.patch<InstallmentResponse>(`${this.base}/installments/${id}/paid`, { paidCount });
  }

  deleteInstallment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/installments/${id}`);
  }

  // ── Account balance ────────────────────────────────────────────────────
  getAccountBalance(id: string): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.base}/accounts/${id}/balance`);
  }
}
