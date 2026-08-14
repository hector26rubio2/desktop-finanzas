import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FinancialApiService } from './financial-api.service';
import { LocalDataRepository } from '../local/local-data.repository';
import { TokenService } from '../auth/token.service';
import type { AccountBalance, AccountResponse } from '../../models/account.model';
import type { LoanResponse } from '../../models/loan.model';
import type {
  InvestmentTransactionDocument,
  PortfolioEntityDocument,
  PortfolioValuationDocument,
} from '../../models/portfolio.model';

describe('FinancialApiService local analytics', () => {
  let service: FinancialApiService;
  let documents: Record<string, unknown[]>;
  let balances: Record<string, AccountBalance>;

  const local = {
    list: async <T>(kind: string) => (documents[kind] ?? []) as T[],
    accountBalances: async <T>(ids: string[]) =>
      Object.fromEntries(
        ids.map((id) => [id, balances[id] ?? { balance: 0, balanceBase: 0, usedInCycle: 0, usedInCycleBase: 0 }]),
      ) as T,
  };
  const token = {
    currentUser: () => ({ id: 'u', email: 'test@finanzas.app', name: 'Test', baseCurrency: 'COP', role: 'User' }),
  };

  beforeEach(() => {
    documents = { movement: [], account: [], loan: [], installmentpurchase: [] };
    balances = {};
    TestBed.configureTestingModule({
      providers: [
        { provide: LocalDataRepository, useValue: local },
        { provide: TokenService, useValue: token },
      ],
    });
    service = TestBed.inject(FinancialApiService);
  });

  afterEach(() => vi.useRealTimers());

  it('uses the shared operating-flow rules and calculates the explicit savings rate', async () => {
    documents['movement'] = [
      movement('income', 'Income', 100, '2026-07-01'),
      movement('expense', 'Expense', 25, '2026-07-02'),
      { ...movement('saving', 'Expense', 20, '2026-07-03'), subType: 'Saving', operationType: 'Saving' },
      { ...movement('transfer-out', 'Expense', 500, '2026-07-04'), operationType: 'Transfer' },
      { ...movement('transfer-in', 'Income', 500, '2026-07-04'), operationType: 'Transfer' },
    ];

    const value = await firstValueFrom(service.getKpis('2026-07'));

    expect(value.income).toBe(100);
    expect(value.expense).toBe(25);
    expect(value.net).toBe(75);
    expect(value.savings).toBe(20);
    expect(value.savingsRate).toBe(20);
  });

  it('uses base-currency balances and classifies overdrafts as liabilities', async () => {
    documents['account'] = [
      account('usd-debit', 'Debit', 'USD'),
      account('overdraft', 'Cash'),
      account('usd-card', 'Credit', 'USD', 1_000),
    ];
    balances = {
      'usd-debit': { balance: 10, balanceBase: 40_000, usedInCycle: 0, usedInCycleBase: 0 },
      overdraft: { balance: -50, balanceBase: -50, usedInCycle: 0, usedInCycleBase: 0 },
      'usd-card': { balance: -5, balanceBase: -20_000, usedInCycle: 5, usedInCycleBase: 20_000 },
    };

    const value = await firstValueFrom(service.getSnapshot());

    expect(value.liquidAssets).toBe(40_000);
    expect(value.creditCardDebt).toBe(20_000);
    expect(value.totalLiabilities).toBe(20_050);
    expect(value.netWorth).toBe(19_950);
    expect(value.accounts.find((x) => x.accountId === 'usd-debit')?.positionBase).toBe(40_000);
    expect(value.accounts.find((x) => x.accountId === 'overdraft')?.positionBase).toBe(-50);
    expect(value.accounts.find((x) => x.accountId === 'usd-card')?.positionBase).toBe(-20_000);
  });

  it('uses the amortization engine for monthly loan service', async () => {
    documents['loan'] = [
      loan('loan-1', { principal: 12_000, outstandingPrincipal: 12_000, termMonths: 12, remainingMonths: 12 }),
    ];

    const value = await firstValueFrom(service.getKpis('2026-07'));

    expect(value.monthlyDebtService).toBeCloseTo(1_066.19, 2);
  });

  it('maps canonical portfolio types, keeps overdrafts in liabilities, and composes assets to 100%', async () => {
    documents['account'] = [
      account('cash', 'Cash'),
      account('bank', 'Debit'),
      account('card', 'Credit', 'COP', 1_000),
      account('overdraft', 'Debit'),
    ];
    balances = {
      cash: { balance: 600, balanceBase: 600, usedInCycle: 0, usedInCycleBase: 0 },
      bank: { balance: 400, balanceBase: 400, usedInCycle: 0, usedInCycleBase: 0 },
      card: { balance: -500, balanceBase: -500, usedInCycle: 500, usedInCycleBase: 500 },
      overdraft: { balance: -100, balanceBase: -100, usedInCycle: 0, usedInCycleBase: 0 },
    };

    const overview = await firstValueFrom(service.getPortfolio());
    const analytics = await firstValueFrom(service.getPortfolioAnalytics());

    expect(overview.totalAssets).toBe(1_000);
    expect(overview.totalLiabilities).toBe(600);
    expect(overview.items.find((x) => x.id === 'cash')).toMatchObject({ kind: 'Asset', type: 'Cash', valueBase: 600 });
    expect(overview.items.find((x) => x.id === 'bank')).toMatchObject({
      kind: 'Asset',
      type: 'BankAccount',
      valueBase: 400,
    });
    expect(overview.items.find((x) => x.id === 'card')).toMatchObject({
      kind: 'Liability',
      type: 'CreditCard',
      valueBase: 500,
    });
    expect(overview.items.find((x) => x.id === 'overdraft')).toMatchObject({
      kind: 'Liability',
      type: 'BankAccount',
      valueBase: 100,
    });
    expect(analytics.composition.map((x) => x.type).sort()).toEqual(['BankAccount', 'Cash']);
    expect(analytics.composition.reduce((sum, x) => sum + x.percentOfAssets, 0)).toBeCloseTo(100, 8);
  });

  it('uses the latest as-of investment valuation without double-counting legacy portfolio entities', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
    documents['account'] = [account('bank', 'Debit')];
    balances['bank'] = { balance: 100, balanceBase: 100, usedInCycle: 0, usedInCycleBase: 0 };
    documents['portfolioentity'] = [
      investment('investment-1', 'Global ETF'),
      { ...investment('legacy-bank', 'Legacy bank'), type: 'BankAccount', legacyAccountId: 'bank' },
    ];
    documents['portfoliovaluation'] = [
      valuation('old', 'investment-1', '2026-07-31', 10, 4_000, 40_000),
      valuation('current', 'investment-1', '2026-08-08', 12.5, 4_000, 50_000),
      valuation('future', 'investment-1', '2026-09-01', 99, 4_000, 396_000),
    ];

    const snapshot = await firstValueFrom(service.getSnapshot());
    const overview = await firstValueFrom(service.getPortfolio());
    const analytics = await firstValueFrom(service.getPortfolioAnalytics());

    expect(snapshot.liquidAssets).toBe(100);
    expect(snapshot.totalAssets).toBe(50_100);
    expect(overview.items.filter((item) => item.id === 'legacy-bank')).toHaveLength(0);
    expect(overview.items.find((item) => item.id === 'investment-1')).toMatchObject({
      kind: 'Asset',
      type: 'Investment',
      valueBase: 50_000,
      valuationDate: '2026-08-08',
      valuationSource: 'MarketPrice',
    });
    expect(analytics.composition.find((item) => item.type === 'Investment')).toMatchObject({
      valueBase: 50_000,
    });
    expect(analytics.composition.reduce((sum, item) => sum + item.percentOfAssets, 0)).toBeCloseTo(100, 8);
  });

  it('builds investment evolution and return from valuations and linked ledger transactions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    documents['portfolioentity'] = [investment('investment-1', 'Fondo')];
    documents['portfoliovaluation'] = [
      valuation('jan', 'investment-1', '2026-01-20', 1_000, 1, 1_000),
      valuation('mar', 'investment-1', '2026-03-10', 1_300, 1, 1_300),
    ];
    documents['movement'] = [
      movement('contribution', 'Expense', 1_000, '2026-01-05'),
      movement('withdrawal', 'Income', 100, '2026-02-10'),
      movement('fee', 'Expense', 10, '2026-03-01'),
    ];
    documents['investmenttransaction'] = [
      transaction('tx-1', 'investment-1', 'contribution', 'Contribution'),
      transaction('tx-2', 'investment-1', 'withdrawal', 'Withdrawal'),
      transaction('tx-3', 'investment-1', 'fee', 'Fee', 5),
    ];

    const value = await firstValueFrom(service.getPortfolioAnalytics(5));

    expect(value.evolution.find((item) => item.date === '2026-01-31')).toMatchObject({
      assets: 1_000,
      liabilities: 0,
      netWorth: 1_000,
    });
    expect(value.evolution.find((item) => item.date === '2026-02-28')).toMatchObject({ assets: 1_000 });
    expect(value.evolution.find((item) => item.date === '2026-03-31')).toMatchObject({ assets: 1_300 });
    expect(value.investments[0]).toEqual({
      entityId: 'investment-1',
      name: 'Fondo',
      currentValueBase: 1_300,
      netContributionsBase: 900,
      feesBase: 15,
      nominalReturnPercent: 38.5,
      realReturnPercent: 31.9,
      concentrationPercent: 100,
      missingData: [],
    });
  });

  it('builds twelve-month balance-sheet evolution from cumulative account and loan movements', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    documents['account'] = [account('bank', 'Debit')];
    documents['loan'] = [
      loan('loan-1', { principal: 1_000, outstandingPrincipal: 900, termMonths: 10, remainingMonths: 9 }),
    ];
    documents['movement'] = [
      {
        ...movement('disbursement', 'Income', 1_000, '2026-01-05'),
        accountId: 'bank',
        loanId: 'loan-1',
        operationType: 'LoanDisbursement',
      },
      { ...movement('living-cost', 'Expense', 100, '2026-02-10'), accountId: 'bank' },
      {
        ...movement('loan-payment', 'Expense', 100, '2026-03-10'),
        accountId: 'bank',
        loanId: 'loan-1',
        principalComponent: 100,
        interestComponent: 0,
        operationType: 'LoanPayment',
      },
    ];
    balances['bank'] = { balance: 800, balanceBase: 800, usedInCycle: 0, usedInCycleBase: 0 };

    const value = await firstValueFrom(service.getPortfolioAnalytics());

    expect(value.evolution).toHaveLength(12);
    expect(value.evolution.find((x) => x.date === '2026-01-31')).toEqual({
      date: '2026-01-31',
      assets: 1_000,
      liabilities: 1_000,
      netWorth: 0,
    });
    expect(value.evolution.find((x) => x.date === '2026-02-28')).toEqual({
      date: '2026-02-28',
      assets: 900,
      liabilities: 1_000,
      netWorth: -100,
    });
    expect(value.evolution.find((x) => x.date === '2026-03-31')).toEqual({
      date: '2026-03-31',
      assets: 800,
      liabilities: 900,
      netWorth: -100,
    });
  });

  it('fails reconciliation when IPC balances diverge from the ledger or amountBase is invalid', async () => {
    documents['account'] = [account('bank', 'Debit')];
    documents['movement'] = [
      { ...movement('bad-base', 'Income', 90, '2026-07-01'), accountId: 'bank', amount: 100, trmApplied: 1 },
    ];
    balances['bank'] = { balance: 100, balanceBase: 100, usedInCycle: 0, usedInCycleBase: 0 };

    const value = await firstValueFrom(service.getReconciliation());

    expect(value.isReconciled).toBe(false);
    expect(value.checks.find((x) => x.metric === 'liquidAssets')).toMatchObject({
      served: 100,
      recalculated: 90,
      matches: false,
    });
    expect(value.checks.find((x) => x.metric === 'amountBaseInvariant')).toMatchObject({
      recalculated: 10,
      matches: false,
    });
  });

  it('approves reconciliation when IPC balances and the ledger independently agree', async () => {
    documents['account'] = [account('bank', 'Debit')];
    documents['movement'] = [{ ...movement('income', 'Income', 100, '2026-07-01'), accountId: 'bank' }];
    balances['bank'] = { balance: 100, balanceBase: 100, usedInCycle: 0, usedInCycleBase: 0 };

    const value = await firstValueFrom(service.getReconciliation());

    expect(value.isReconciled).toBe(true);
    expect(value.checks.every((x) => x.matches)).toBe(true);
  });

  it('independently detects stale outstanding loan principal', async () => {
    documents['loan'] = [loan('loan-1', { principal: 1_000, outstandingPrincipal: 900 })];

    const value = await firstValueFrom(service.getReconciliation());

    expect(value.isReconciled).toBe(false);
    expect(value.checks.find((x) => x.metric === 'loanDebt')).toMatchObject({
      served: 900,
      recalculated: 1_000,
      matches: false,
    });
  });

  it('fails explicit portfolio coverage for missing valuations, malformed base amounts, and orphan transactions', async () => {
    documents['portfolioentity'] = [investment('investment-1', 'Fondo')];
    documents['portfoliovaluation'] = [
      valuation('bad', 'investment-1', '2026-08-01', 100, 2, Number.NaN),
    ];
    documents['movement'] = [{ ...movement('bad-movement', 'Expense', Number.NaN, '2026-08-01'), amount: 100 }];
    documents['investmenttransaction'] = [
      transaction('orphan', 'investment-1', 'missing-movement', 'Contribution'),
    ];

    const value = await firstValueFrom(service.getReconciliation());

    expect(value.isReconciled).toBe(false);
    expect(value.checks.find((item) => item.metric === 'portfolioValuationCoverage')?.recalculated).toBe(1);
    expect(value.checks.find((item) => item.metric === 'unverifiablePortfolioValuation')?.recalculated).toBe(1);
    expect(value.checks.find((item) => item.metric === 'unverifiableMovementAmountBase')?.recalculated).toBe(1);
    expect(value.checks.find((item) => item.metric === 'investmentTransactionCoverage')?.recalculated).toBe(1);
  });

  it('reconciles a valid standalone investment valuation into assets', async () => {
    documents['portfolioentity'] = [investment('investment-1', 'Fondo')];
    documents['portfoliovaluation'] = [valuation('value', 'investment-1', '2026-08-01', 100, 2, 200)];

    const value = await firstValueFrom(service.getReconciliation());

    expect(value.isReconciled).toBe(true);
    expect(value.checks.find((item) => item.metric === 'portfolioAssets')).toMatchObject({
      served: 200,
      recalculated: 200,
      matches: true,
    });
    expect(value.checks.find((item) => item.metric === 'portfolioValuationCoverage')?.matches).toBe(true);
  });
});

describe('credit-card debt agrees between the snapshot and the historical series', () => {
  // Son dos caminos distintos hacia la misma cifra: el snapshot pide el saldo al
  // proceso main (regla `debtSign`: solo movimientos de tarjeta y pagos), y la
  // serie histórica reduce TODOS los movimientos de la cuenta por su `type`.
  // Con datos bien formados deben coincidir; si divergen, una de las dos miente
  // y el usuario ve una deuda distinta según la pantalla que abra.
  let service: FinancialApiService;
  let documents: Record<string, unknown[]>;
  let balances: Record<string, AccountBalance>;

  const local = {
    list: async <T>(kind: string) => (documents[kind] ?? []) as T[],
    accountBalances: async <T>(ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, balances[id]])) as T,
  };
  const token = {
    currentUser: () => ({ id: 'u', email: 'test@finanzas.app', name: 'Test', baseCurrency: 'COP', role: 'User' }),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
    // Compra a crédito de 300 y pago de 100 → deuda viva 200.
    documents = {
      movement: [
        { ...movement('compra', 'Expense', 300, '2026-07-05'), accountId: 'card', sourceType: 'CreditCard', operationType: 'CreditPurchase' },
        { ...movement('pago', 'Income', 100, '2026-07-20'), accountId: 'card', sourceType: 'CreditCard', operationType: 'CreditPayment' },
      ],
      account: [account('card', 'Credit', 'COP', 1_000)],
      loan: [],
      installmentpurchase: [],
    };
    // Lo que devolvería `database.js` con la regla debtSign: 300 - 100.
    balances = { card: { balance: -200, balanceBase: -200, usedInCycle: 300, usedInCycleBase: 300, outstandingDebt: 200, outstandingDebtBase: 200 } as AccountBalance };
    TestBed.configureTestingModule({
      providers: [
        { provide: LocalDataRepository, useValue: local },
        { provide: TokenService, useValue: token },
      ],
    });
    service = TestBed.inject(FinancialApiService);
  });

  afterEach(() => vi.useRealTimers());

  it('reports the same live debt through both paths', async () => {
    const snapshot = await firstValueFrom(service.getSnapshot());
    const analytics = await firstValueFrom(service.getPortfolioAnalytics());
    const currentMonth = analytics.evolution[analytics.evolution.length - 1];

    expect(snapshot.creditCardDebt).toBe(200);
    expect(currentMonth.liabilities).toBe(200);
    expect(snapshot.creditCardDebt).toBe(currentMonth.liabilities);
    // Y ninguno de los dos convierte la deuda en patrimonio positivo.
    expect(snapshot.netWorth).toBe(-200);
  });
});

function account(
  id: string,
  type: AccountResponse['type'],
  currency = 'COP',
  creditLimit: number | null = null,
): AccountResponse {
  return {
    id,
    name: id,
    type,
    currency,
    bank: null,
    lastFour: null,
    creditLimit,
    billingDay: null,
    paymentDay: null,
    interestRate: null,
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function loan(id: string, overrides: Partial<LoanResponse> = {}): LoanResponse {
  return {
    id,
    userId: 'u',
    description: id,
    party: null,
    principal: 12_000,
    currency: 'COP',
    trmApplied: 1,
    interestRateAnnual: 12,
    termMonths: 12,
    startDate: '2026-01-01',
    loanType: 'French',
    accountId: null,
    isActive: true,
    paidMonths: 0,
    remainingMonths: 12,
    paidPrincipal: 0,
    outstandingPrincipal: 12_000,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function movement(id: string, type: 'Income' | 'Expense', amountBase: number, date: string) {
  return {
    id,
    type,
    subType: type,
    sourceType: 'OwnAccount',
    amount: amountBase,
    currency: 'COP',
    trmApplied: 1,
    amountBase,
    date,
    categoryId: null,
    categoryName: null,
    accountId: null,
    operationType: null,
  };
}

function investment(id: string, name: string): PortfolioEntityDocument {
  return {
    id,
    userId: 'u',
    kind: 'Asset',
    type: 'Investment',
    name,
    currency: 'USD',
    institution: 'Broker',
    legacyAccountId: null,
    legacyLoanId: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function valuation(
  id: string,
  portfolioEntityId: string,
  date: string,
  amount: number,
  trmApplied: number,
  amountBase: number,
): PortfolioValuationDocument {
  return {
    id,
    portfolioEntityId,
    date,
    amount,
    currency: 'USD',
    trmApplied,
    amountBase,
    source: 'MarketPrice',
    externalReference: null,
    createdAt: `${date}T12:00:00Z`,
  };
}

function transaction(
  id: string,
  portfolioEntityId: string,
  movementId: string,
  type: InvestmentTransactionDocument['type'],
  feeAmountBase = 0,
): InvestmentTransactionDocument {
  return {
    id,
    portfolioEntityId,
    movementId,
    type,
    quantity: null,
    unitPrice: null,
    feeAmountBase,
    createdAt: '2026-01-01T00:00:00Z',
  };
}
