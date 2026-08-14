import { Injectable, inject } from '@angular/core';
import { LocalDataRepository, type LocalKind } from './local/local-data.repository';
import { TokenService } from './auth/token.service';

const FINANCIAL_DATA_KINDS = [
  'movement',
  'account',
  'loan',
  'installmentpurchase',
  'recurringtransaction',
  'portfolioentity',
  'portfoliovaluation',
  'investmenttransaction',
] as const satisfies readonly LocalKind[];

export type BaseCurrencyChangeResult =
  | { status: 'changed'; currency: string }
  | { status: 'unchanged'; currency: string }
  | { status: 'blocked'; currency: string; blockingKind: (typeof FINANCIAL_DATA_KINDS)[number] }
  | { status: 'unavailable'; currency: string };

@Injectable({ providedIn: 'root' })
export class BaseCurrencyPolicyService {
  private local = inject(LocalDataRepository);
  private token = inject(TokenService);

  async change(requestedCode: string): Promise<BaseCurrencyChangeResult> {
    const currency = requestedCode.trim().toUpperCase();
    const current = this.token.currentUser()?.baseCurrency ?? 'COP';

    // Selecting the current currency is always safe and requires no database access.
    if (currency === current) return { status: 'unchanged', currency };

    // Fail closed when the encrypted local store cannot be inspected.
    if (!this.local.available) return { status: 'unavailable', currency: current };

    try {
      for (const kind of FINANCIAL_DATA_KINDS) {
        const documents = await this.local.list<unknown>(kind);
        if (documents.length > 0) {
          return { status: 'blocked', currency: current, blockingKind: kind };
        }
      }
    } catch {
      return { status: 'unavailable', currency: current };
    }

    this.token.updateBaseCurrency(currency);
    return { status: 'changed', currency };
  }
}
