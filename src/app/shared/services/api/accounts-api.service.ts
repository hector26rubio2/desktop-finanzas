import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { AccountResponse, AccountRequest, AccountBalance } from '../../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

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

  getAccountBalance(id: string): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.base}/accounts/${id}/balance`);
  }

  getAccountBalances(ids: string[]): Observable<Record<string, AccountBalance>> {
    if (ids.length === 0)
      return new Observable<Record<string, AccountBalance>>((s) => {
        s.next({});
        s.complete();
      });
    let params = new HttpParams();
    for (const id of ids) {
      params = params.append('ids', id);
    }
    return this.http.get<Record<string, AccountBalance>>(`${this.base}/accounts/balances`, { params });
  }
}
