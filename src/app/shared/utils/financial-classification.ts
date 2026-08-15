import type { MovementResponse } from '../models/movement.model';

const NON_OPERATING_OPERATIONS = new Set([
  'Transfer',
  'Saving',
  'CreditPayment',
  'LoanDisbursement',
]);

const NON_OPERATING_SUBTYPES = new Set(['LoanReceived', 'LoanGiven', 'Saving']);

export interface FinancialFlowContribution {
  income: number;
  expense: number;
}

export function financialFlowContribution(movement: MovementResponse): FinancialFlowContribution {
  if (movement.investmentTransactionType === 'Fee') {
    const value = Number(movement.amountBase || 0);
    return { income: 0, expense: movement.type === 'Expense' ? value : 0 };
  }
  if (movement.investmentTransactionType) {
    return { income: 0, expense: 0 };
  }
  if (movement.operationType === 'LoanPayment') {
    const interestBase = Number(movement.interestComponent ?? 0) * Number(movement.trmApplied || 1);
    return { income: 0, expense: movement.type === 'Expense' ? interestBase : 0 };
  }
  if (
    NON_OPERATING_OPERATIONS.has(movement.operationType ?? '')
    || NON_OPERATING_SUBTYPES.has(movement.subType ?? '')
  ) {
    return { income: 0, expense: 0 };
  }
  const value = Number(movement.amountBase || 0);
  return movement.type === 'Income' ? { income: value, expense: 0 } : { income: 0, expense: value };
}

export function isOperatingExpense(movement: MovementResponse): boolean {
  return financialFlowContribution(movement).expense > 0;
}

export function sumBaseAmount(movements: readonly MovementResponse[]): number {
  return movements.reduce((total, movement) => total + Number(movement.amountBase || 0), 0);
}
