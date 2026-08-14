import { Injectable, inject } from '@angular/core';
import { Observable, from, of, switchMap } from 'rxjs';
import { LocalDataRepository } from '../local/local-data.repository';
import type { AccountResponse, AccountRequest, AccountBalance } from '../../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private local = inject(LocalDataRepository);

  getAccounts(): Observable<AccountResponse[]> {
    return from(this.local.list<AccountResponse>('account'));
  }

  createAccount(req: AccountRequest): Observable<AccountResponse> {
    return from(this.local.put('account', this.localAccount(req), 'create'));
  }

  updateAccount(id: string, req: AccountRequest): Observable<AccountResponse> {
    return from(this.local.put('account', this.localAccount(req, id), 'update'));
  }

  deleteAccount(id: string): Observable<void> {
    return from(this.local.remove('account', id));
  }

  getAccountBalance(id: string): Observable<AccountBalance> {
    return from(this.local.accountBalances<Record<string, AccountBalance>>([id])).pipe(
      switchMap((result) => of(result[id] ?? { balance: 0, usedInCycle: 0 })),
    );
  }

  getAccountBalances(ids: string[]): Observable<Record<string, AccountBalance>> {
    if (ids.length === 0) return of({} as Record<string, AccountBalance>);
    return from(this.local.accountBalances<Record<string, AccountBalance>>(ids));
  }

  private localAccount(req: AccountRequest, id: string = crypto.randomUUID()): AccountResponse {
    return {
      id,
      ...req,
      bank: req.bank ?? null,
      lastFour: req.lastFour ?? null,
      creditLimit: req.creditLimit ?? null,
      billingDay: req.billingDay ?? null,
      paymentDay: req.paymentDay ?? null,
      interestRate: req.interestRate ?? null,
      isDefault: req.isDefault ?? false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  }
}
