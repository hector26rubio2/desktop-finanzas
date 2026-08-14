import { describe, expect, it } from 'vitest';
import { auditLocalData, type LocalDataAuditInput } from './local-data-audit';
import { planLocalDataRepair } from './local-data-repair';

function input(overrides: Partial<LocalDataAuditInput> = {}): LocalDataAuditInput {
  return { movements: [], accounts: [], categories: [], loans: [], installmentPurchases: [], ...overrides };
}

const account = { id: 'cash', name: 'Efectivo', type: 'Debit', currency: 'COP', isActive: true };
const card = { id: 'card', name: 'Tarjeta', type: 'Credit', currency: 'COP', isActive: true };

describe('planLocalDataRepair', () => {
  it('recalculates amountBase when the arithmetic is available', () => {
    const data = input({
      accounts: [account],
      movements: [
        { id: 'm1', type: 'Expense', accountId: 'cash', amount: 10, currency: 'USD', trmApplied: 4000, amountBase: 10, date: '2026-07-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    expect(plan.applied).toBe(false);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ entityId: 'm1', field: 'amountBase', before: 10, after: 40_000 });
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({ action: 'put', kind: 'movement' });
  });

  it('refuses to invent a missing TRM and lists the case for the user', () => {
    const data = input({
      accounts: [account],
      movements: [
        { id: 'm1', type: 'Expense', accountId: 'cash', amount: 10, currency: 'USD', trmApplied: 0, amountBase: 10, date: '2026-07-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    expect(plan.changes).toHaveLength(0);
    expect(plan.operations).toHaveLength(0);
    expect(plan.skipped.some((item) => item.entityId === 'm1' && /inventar/.test(item.reason))).toBe(true);
  });

  it('derives the loan payment counter from the ledger', () => {
    const data = input({
      accounts: [account],
      loans: [
        { id: 'l1', description: 'Banco', principal: 1200, currency: 'COP', trmApplied: 1, paidMonths: 5, outstandingPrincipal: 1100, startDate: '2026-01-01' },
      ],
      movements: [
        { id: 'd1', type: 'Income', accountId: 'cash', loanId: 'l1', operationType: 'LoanDisbursement', amount: 1200, currency: 'COP', trmApplied: 1, amountBase: 1200, date: '2026-01-01' },
        { id: 'p1', type: 'Expense', accountId: 'cash', loanId: 'l1', operationType: 'LoanPayment', amount: 100, currency: 'COP', trmApplied: 1, amountBase: 100, principalComponent: 100, date: '2026-02-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    const counter = plan.changes.find((item) => item.field === 'paidMonths');
    expect(counter).toMatchObject({ entityId: 'l1', before: 5, after: 1 });
  });

  it('counts installment payments as operations, not as legs', () => {
    const data = input({
      accounts: [account, card],
      installmentPurchases: [
        { id: 'plan-1', purchaseMovementId: 'buy', accountId: 'card', currency: 'COP', totalAmount: 300, monthlyAmount: 100, installmentsCount: 3, paidCount: 2 },
      ],
      movements: [
        { id: 'buy', type: 'Expense', accountId: 'card', sourceType: 'CreditCard', installmentPurchaseId: 'plan-1', amount: 300, currency: 'COP', trmApplied: 1, amountBase: 300, date: '2026-07-01' },
        // Un solo pago con sus dos patas.
        { id: 'pay-out', type: 'Expense', accountId: 'cash', operationType: 'CreditPayment', operationId: 'op-1', installmentPurchaseId: 'plan-1', amount: 100, currency: 'COP', trmApplied: 1, amountBase: 100, date: '2026-08-01' },
        { id: 'pay-in', type: 'Income', accountId: 'card', operationType: 'CreditPayment', operationId: 'op-1', installmentPurchaseId: 'plan-1', amount: 100, currency: 'COP', trmApplied: 1, amountBase: 100, date: '2026-08-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    const counter = plan.changes.find((item) => item.field === 'paidCount');
    expect(counter).toMatchObject({ entityId: 'plan-1', before: 2, after: 1 });
  });

  it('never repairs an incomplete paired operation', () => {
    const data = input({
      accounts: [account],
      movements: [
        // Media transferencia: falta la pata de entrada.
        { id: 't1', type: 'Expense', accountId: 'cash', operationType: 'Transfer', operationId: 'op-9', amount: 50, currency: 'COP', trmApplied: 1, amountBase: 50, date: '2026-07-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    expect(plan.changes).toHaveLength(0);
    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.requiresDecision).toBeGreaterThan(0);
    expect(plan.skipped.every((item) => /decisión tuya/.test(item.reason) || /inventar/.test(item.reason))).toBe(true);
  });

  it('writes each document once even when it accumulates several findings', () => {
    const data = input({
      accounts: [account],
      loans: [
        { id: 'l1', description: 'Banco', principal: 1200, currency: 'COP', trmApplied: 1, paidMonths: 9, outstandingPrincipal: 1200, startDate: '2026-01-01' },
      ],
      movements: [
        { id: 'd1', type: 'Income', accountId: 'cash', loanId: 'l1', operationType: 'LoanDisbursement', amount: 1200, currency: 'COP', trmApplied: 1, amountBase: 1200, date: '2026-01-01' },
      ],
    });
    const plan = planLocalDataRepair(auditLocalData(data), data);

    const loanOperations = plan.operations.filter((operation) => operation.kind === 'loan');
    expect(loanOperations).toHaveLength(1);
    expect(plan.summary.findings).toBe(plan.summary.repairable + plan.summary.requiresDecision);
  });
});
