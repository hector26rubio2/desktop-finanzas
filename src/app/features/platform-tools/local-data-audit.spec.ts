import { describe, expect, it } from 'vitest';
import { auditLocalData, type LocalDataAuditInput } from './local-data-audit';

const emptyData = (): LocalDataAuditInput => ({
  movements: [],
  accounts: [],
  categories: [],
  loans: [],
  installmentPurchases: [],
});

const movement = (overrides: Record<string, unknown> = {}) => ({
  id: 'movement-1',
  type: 'Expense',
  amount: 100,
  currency: 'COP',
  trmApplied: 1,
  amountBase: 100,
  date: '2026-08-09',
  accountId: null,
  categoryId: null,
  loanId: null,
  installmentPurchaseId: null,
  operationId: null,
  operationType: null,
  ...overrides,
});

describe('auditLocalData', () => {
  it('detecta amountBase inválido y referencias huérfanas', () => {
    const data = emptyData();
    data.movements = [
      movement({
        amountBase: 90,
        accountId: 'missing-account',
        categoryId: 'missing-category',
        loanId: 'missing-loan',
        installmentPurchaseId: 'missing-plan',
      }),
    ];

    const report = auditLocalData(data);
    expect(report.findings.map((finding) => finding.code)).toEqual([
      'movement_account_missing',
      'movement_amount_base_invalid',
      'movement_category_missing',
      'movement_installment_plan_missing',
      'movement_loan_missing',
    ]);
    expect(report.summary).toMatchObject({ total: 5, critical: 0, error: 5 });
  });

  it('detecta préstamos sin desembolso y conserva los correctamente enlazados', () => {
    const data = emptyData();
    data.accounts = [{ id: 'account-1' }];
    data.loans = [
      { id: 'loan-missing', accountId: 'account-1' },
      { id: 'loan-ok', accountId: 'account-1' },
    ];
    data.movements = [
      movement({
        id: 'loan-ok:disbursement',
        type: 'Income',
        loanId: 'loan-ok',
        accountId: 'account-1',
        operationId: 'loan-ok',
        operationType: 'LoanDisbursement',
      }),
    ];

    const report = auditLocalData(data);
    expect(report.findings.filter((finding) => finding.code === 'loan_disbursement_missing')).toEqual([
      expect.objectContaining({ entityId: 'loan-missing', severity: 'critical' }),
    ]);
  });

  it('detecta planes sin compra, enlaces inconsistentes y movimientos con plan inexistente', () => {
    const data = emptyData();
    data.accounts = [{ id: 'credit-1' }];
    data.installmentPurchases = [
      { id: 'plan-no-link', accountId: 'credit-1', purchaseMovementId: null },
      { id: 'plan-missing-movement', accountId: 'credit-1', purchaseMovementId: 'missing-purchase' },
      { id: 'plan-inconsistent', accountId: 'credit-1', purchaseMovementId: 'purchase-wrong' },
    ];
    data.movements = [
      movement({
        id: 'purchase-wrong',
        accountId: 'credit-1',
        installmentPurchaseId: 'plan-inconsistent',
        operationType: null,
      }),
      movement({ id: 'orphan-payment', installmentPurchaseId: 'unknown-plan' }),
    ];

    const report = auditLocalData(data);
    const codes = new Set(report.findings.map((finding) => finding.code));
    expect(codes).toEqual(
      new Set([
        'installment_purchase_link_missing',
        'installment_purchase_movement_missing',
        'installment_purchase_link_inconsistent',
        'installment_credit_purchase_missing',
        'movement_installment_plan_missing',
      ]),
    );
  });

  it('detecta operaciones pareadas incompletas o desbalanceadas', () => {
    const data = emptyData();
    data.accounts = [{ id: 'source' }, { id: 'destination' }];
    data.movements = [
      movement({
        id: 'incomplete:source',
        accountId: 'source',
        operationId: 'incomplete',
        operationType: 'Transfer',
      }),
      movement({
        id: 'unbalanced:source',
        accountId: 'source',
        operationId: 'unbalanced',
        operationType: 'Transfer',
      }),
      movement({
        id: 'unbalanced:destination',
        type: 'Income',
        amount: 80,
        amountBase: 80,
        accountId: 'destination',
        operationId: 'unbalanced',
        operationType: 'Transfer',
      }),
      movement({
        id: 'interest-only',
        accountId: 'destination',
        operationId: 'interest-only',
        operationType: 'CreditInterest',
      }),
    ];

    const report = auditLocalData(data);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'paired_operation_incomplete', entityId: 'incomplete' }),
        expect.objectContaining({ code: 'paired_operation_unbalanced', entityId: 'unbalanced' }),
        expect.objectContaining({ code: 'credit_interest_payment_pair_missing', entityId: 'interest-only' }),
      ]),
    );
    expect(report.summary.critical).toBe(3);
  });

  it('produce un reporte limpio para relaciones financieras consistentes', () => {
    const data = emptyData();
    data.accounts = [{ id: 'cash' }, { id: 'credit' }];
    data.categories = [{ id: 'category' }];
    data.loans = [{ id: 'loan', accountId: 'cash', principal: 100, outstandingPrincipal: 100, paidMonths: 0 }];
    data.installmentPurchases = [{ id: 'plan', accountId: 'credit', purchaseMovementId: 'purchase', paidCount: 1 }];
    data.movements = [
      movement({
        id: 'loan:disbursement',
        type: 'Income',
        accountId: 'cash',
        loanId: 'loan',
        operationId: 'loan',
        operationType: 'LoanDisbursement',
      }),
      movement({
        id: 'purchase',
        accountId: 'credit',
        categoryId: 'category',
        installmentPurchaseId: 'plan',
        operationId: 'plan',
        operationType: 'CreditPurchase',
      }),
      movement({
        id: 'payment:source',
        accountId: 'cash',
        installmentPurchaseId: 'plan',
        operationId: 'payment',
        operationType: 'CreditPayment',
      }),
      movement({
        id: 'payment:destination',
        type: 'Income',
        accountId: 'credit',
        installmentPurchaseId: 'plan',
        operationId: 'payment',
        operationType: 'CreditPayment',
      }),
    ];

    const report = auditLocalData(data);
    expect(report.summary).toMatchObject({ total: 0, critical: 0, error: 0, warning: 0 });
    expect(report.findings).toEqual([]);
    expect(report.readOnly).toBe(true);
  });

  it('detecta proyecciones de deuda que no concilian con sus movimientos', () => {
    const data = emptyData();
    data.accounts = [{ id: 'cash' }, { id: 'credit' }];
    data.loans = [{ id: 'loan', accountId: 'cash', principal: 100, outstandingPrincipal: 100, paidMonths: 2 }];
    data.installmentPurchases = [{ id: 'plan', accountId: 'credit', purchaseMovementId: 'purchase', paidCount: 2 }];
    data.movements = [
      movement({
        id: 'legacy-loan',
        type: 'Income',
        sourceType: 'Loan',
        subType: 'LoanReceived',
        accountId: 'cash',
      }),
      movement({
        id: 'loan:disbursement',
        type: 'Income',
        accountId: 'cash',
        loanId: 'loan',
        operationId: 'loan',
        operationType: 'LoanDisbursement',
      }),
      movement({
        id: 'purchase',
        accountId: 'credit',
        installmentPurchaseId: 'plan',
        operationId: 'plan',
        operationType: 'CreditPurchase',
      }),
    ];

    const codes = new Set(auditLocalData(data).findings.map((finding) => finding.code));
    expect(codes.has('movement_loan_link_missing')).toBe(true);
    expect(codes.has('loan_payment_count_mismatch')).toBe(true);
    expect(codes.has('installment_payment_count_mismatch')).toBe(true);
  });
});
