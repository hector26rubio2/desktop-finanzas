import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import type { MovementResponse } from '../../models/movement.model';
import type { PortfolioEntityDocument } from '../../models/portfolio.model';
import { TokenService } from '../auth/token.service';
import { LocalDataRepository, type LocalBatchOperation, type LocalKind } from '../local/local-data.repository';
import { FinancialApiService } from './financial-api.service';
import { PortfolioApiService } from './portfolio-api.service';

describe('PortfolioApiService local investments', () => {
  let service: PortfolioApiService;
  let documents: Map<LocalKind, Map<string, { id: string }>>;

  const local = {
    list: async <T>(kind: LocalKind) => [...(documents.get(kind)?.values() ?? [])] as T[],
    get: async <T>(kind: LocalKind, id: string) => (documents.get(kind)?.get(id) as T) ?? null,
    put: async <T extends { id: string }>(kind: LocalKind, value: T) => {
      seed(kind, value);
      return value;
    },
    batch: async (operations: LocalBatchOperation[]) => {
      for (const operation of operations) {
        if (operation.action === 'put') seed(operation.kind, operation.value as { id: string });
        else documents.get(operation.kind)?.delete(operation.id);
      }
      return [];
    },
  };

  beforeEach(() => {
    documents = new Map();
    TestBed.configureTestingModule({
      providers: [
        { provide: LocalDataRepository, useValue: local },
        { provide: FinancialApiService, useValue: { getPortfolio: () => of(null) } },
        {
          provide: TokenService,
          useValue: {
            currentUser: () => ({ id: 'u', email: 'test@finanzas.app', name: 'Test', baseCurrency: 'COP', role: 'User' }),
          },
        },
      ],
    });
    service = TestBed.inject(PortfolioApiService);
  });

  it('creates an investment and stores a base-currency valuation locally', async () => {
    const investment = await firstValueFrom(
      service.createInvestment({ name: ' Fondo global ', currency: 'usd', institution: ' Broker ' }),
    );
    const valuation = await firstValueFrom(
      service.addValuation(investment.id, {
        date: '2026-08-08',
        amount: 12.5,
        currency: 'USD',
        trmApplied: 4_000,
        source: 'MarketPrice',
      }),
    );

    expect(investment).toMatchObject({
      kind: 'Asset',
      type: 'Investment',
      name: 'Fondo global',
      currency: 'USD',
      institution: 'Broker',
      isActive: true,
    });
    expect(valuation).toMatchObject({
      portfolioEntityId: investment.id,
      amount: 12.5,
      trmApplied: 4_000,
      amountBase: 50_000,
      source: 'MarketPrice',
    });
    expect(documents.get('portfoliovaluation')?.get(valuation.id)).toEqual(valuation);
  });

  it('atomically links a real movement to an investment transaction', async () => {
    seed('portfolioentity', investment('investment-1'));
    seed('movement', movement('movement-1', 300));

    const transaction = await firstValueFrom(
      service.addTransaction('investment-1', {
        movementId: 'movement-1',
        type: 'Buy',
        quantity: 3,
        unitPrice: 100,
        feeAmountBase: 2,
      }),
    );

    expect(transaction).toMatchObject({
      portfolioEntityId: 'investment-1',
      movementId: 'movement-1',
      type: 'Buy',
      quantity: 3,
      unitPrice: 100,
      feeAmountBase: 2,
    });
    expect(documents.get('movement')?.get('movement-1')).toMatchObject({
      portfolioEntityId: 'investment-1',
      portfolioType: 'Investment',
      investmentTransactionType: 'Buy',
    });
    expect(documents.get('investmenttransaction')?.get(transaction.id)).toEqual(transaction);
  });

  it('rejects duplicate movement links and invalid ISO valuation currencies', async () => {
    seed('portfolioentity', investment('investment-1'));
    seed('movement', movement('movement-1', 300));
    seed('investmenttransaction', {
      id: 'tx-existing',
      portfolioEntityId: 'investment-1',
      movementId: 'movement-1',
      type: 'Contribution',
      quantity: null,
      unitPrice: null,
      feeAmountBase: 0,
      createdAt: '2026-08-01T00:00:00Z',
    });

    await expect(
      firstValueFrom(
        service.addValuation('investment-1', {
          date: '2026-08-08',
          amount: 100,
          currency: 'EU',
          trmApplied: 1,
          source: 'Manual',
        }),
      ),
    ).rejects.toThrow('currency_must_be_iso_4217');
    await expect(
      firstValueFrom(
        service.addTransaction('investment-1', {
          movementId: 'movement-1',
          type: 'Contribution',
        }),
      ),
    ).rejects.toThrow('investment_movement_already_registered');
  });

  it('enforces the ledger direction for every investment transaction type', async () => {
    seed('portfolioentity', investment('investment-1'));
    seed('movement', movement('expense-movement', 300));

    await expect(
      firstValueFrom(
        service.addTransaction('investment-1', {
          movementId: 'expense-movement',
          type: 'Withdrawal',
        }),
      ),
    ).rejects.toThrow('investment_transaction_movement_direction_invalid');
  });

  function seed(kind: LocalKind, value: { id: string }): void {
    const values = documents.get(kind) ?? new Map<string, { id: string }>();
    values.set(value.id, value);
    documents.set(kind, values);
  }
});

function investment(id: string): PortfolioEntityDocument {
  return {
    id,
    userId: 'u',
    kind: 'Asset',
    type: 'Investment',
    name: id,
    currency: 'USD',
    institution: null,
    legacyAccountId: null,
    legacyLoanId: null,
    isActive: true,
    createdAt: '2026-08-01T00:00:00Z',
  };
}

function movement(id: string, amountBase: number): MovementResponse {
  return {
    id,
    type: 'Expense',
    subType: 'Saving',
    sourceType: 'OwnAccount',
    loanParty: null,
    loanInstallments: null,
    loanInterestRate: null,
    amount: amountBase,
    currency: 'COP',
    trmApplied: 1,
    amountBase,
    date: '2026-08-01',
    description: null,
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categoryIcon: null,
    accountId: null,
    accountName: null,
    installmentPurchaseId: null,
    operationId: null,
    operationType: 'Saving',
    createdAt: '2026-08-01T00:00:00Z',
  };
}
