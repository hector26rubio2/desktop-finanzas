import { describe, expect, it } from 'vitest';
import type { MovementResponse } from '../models/movement.model';
import { financialFlowContribution } from './financial-classification';

const movement = (value: Partial<MovementResponse>): MovementResponse => ({
  id: 'm', type: 'Expense', subType: 'Expense', sourceType: 'OwnAccount', loanParty: null,
  loanInstallments: null, loanInterestRate: null, amount: 100, currency: 'COP', trmApplied: 1,
  amountBase: 100, date: '2026-08-01', description: null, categoryId: null, categoryName: null,
  categoryColor: null, categoryIcon: null, accountId: null, accountName: null,
  installmentPurchaseId: null, operationId: null, operationType: null, createdAt: '2026-08-01',
  ...value,
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
