import { describe, expect, it } from 'vitest';
import type { MovementResponse } from '../models/movement.model';
import { financialFlowContribution, sumBaseAmount } from './financial-classification';
import { roundMoney } from './amortization';

const movement = (value: Partial<MovementResponse>): MovementResponse => ({
  id: 'm', type: 'Expense', subType: 'Expense', sourceType: 'OwnAccount', loanParty: null,
  loanInstallments: null, loanInterestRate: null, amount: 100, currency: 'COP', trmApplied: 1,
  amountBase: 100, date: '2026-08-01', description: null, categoryId: null, categoryName: null,
  categoryColor: null, categoryIcon: null, accountId: null, accountName: null,
  installmentPurchaseId: null, operationId: null, operationType: null, createdAt: '2026-08-01',
  ...value,
});

describe('sumBaseAmount', () => {

  it('adds in base currency instead of mixing currencies', () => {
    const dolares = movement({ amount: 10, currency: 'USD', trmApplied: 4000, amountBase: 40_000 });
    const pesos = movement({ amount: 5_000, currency: 'COP', trmApplied: 1, amountBase: 5_000 });

    expect(sumBaseAmount([dolares, pesos])).toBe(45_000);

    expect(dolares.amount + pesos.amount).toBe(5_010);
  });

  it('contributes zero for a movement without a converted amount', () => {
    expect(sumBaseAmount([movement({ amountBase: null as unknown as number })])).toBe(0);
    expect(sumBaseAmount([])).toBe(0);
  });

  it('keeps a thousand cent-sized amounts exact to the cent', () => {
    const centimos = Array.from({ length: 1000 }, () => movement({ amount: 0.1, amountBase: 0.1 }));

    const bruto = sumBaseAmount(centimos);
    expect(bruto).not.toBe(100);
    expect(roundMoney(bruto)).toBe(100);
  });

  it('survives amounts with cents at a realistic scale', () => {
    const movimientos = [12_345.67, 89.99, 0.01, 7_000.45, 1_234_567.89].map((amountBase) =>
      movement({ amount: amountBase, amountBase }),
    );
    expect(roundMoney(sumBaseAmount(movimientos))).toBe(1_254_004.01);
  });
});

describe('financialFlowContribution', () => {
  it('excludes transfers, savings, card payments and loan disbursements', () => {
    for (const operationType of ['Transfer', 'Saving', 'CreditPayment', 'LoanDisbursement'] as const) {
      expect(financialFlowContribution(movement({ operationType }))).toEqual({ income: 0, expense: 0 });
    }
  });

  it('counts only loan interest as expense', () => {
    expect(financialFlowContribution(movement({ operationType: 'LoanPayment', interestComponent: 12, trmApplied: 4 })))
      .toEqual({ income: 0, expense: 48 });
  });

  it('keeps ordinary income, purchases and credit interest in operating flow', () => {
    expect(financialFlowContribution(movement({ type: 'Income', amountBase: 250 }))).toEqual({ income: 250, expense: 0 });
    expect(financialFlowContribution(movement({ operationType: 'CreditPurchase', amountBase: 80 }))).toEqual({ income: 0, expense: 80 });
    expect(financialFlowContribution(movement({ operationType: 'CreditInterest', amountBase: 5 }))).toEqual({ income: 0, expense: 5 });
  });

  it('excludes investment balance-sheet flows but keeps investment fees as expense', () => {
    for (const investmentTransactionType of ['Contribution', 'Withdrawal', 'Buy', 'Sell'] as const) {
      expect(financialFlowContribution(movement({ investmentTransactionType }))).toEqual({ income: 0, expense: 0 });
    }
    expect(
      financialFlowContribution(
        movement({ investmentTransactionType: 'Fee', subType: 'Saving', operationType: 'Saving', amountBase: 25 }),
      ),
    ).toEqual({ income: 0, expense: 25 });
  });
});
