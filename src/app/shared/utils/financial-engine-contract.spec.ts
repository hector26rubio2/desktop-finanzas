import contract from '../../../../../docs/refactor/fixtures/financial-engine-contract.json';
import { buildAmortization, simulatePrepayment, toBase } from './index';

describe('portable financial engine contract v1', () => {
  it('conforms money conversion cases', () => {
    expect(contract.contract).toBe('finanzas.financial-engine');
    expect(contract.version).toBe(1);
    for (const item of contract.moneyConversions) expect(toBase(item.amount, item.rate)).toBe(item.expectedBase);
  });

  it('conforms amortization cases', () => {
    for (const item of contract.amortizations) {
      const rows = buildAmortization(
        item.principal,
        item.annualRatePercent,
        item.months,
        '',
        item.type as 'French' | 'German' | 'American',
      );
      expect(rows.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(item.expectedPrincipal, 2);
      expect(rows.reduce((sum, row) => sum + row.interest, 0)).toBeCloseTo(item.expectedInterest, 2);
      expect(rows.at(-1)?.balance).toBe(item.expectedFinalBalance);
      expect(rows.map((row) => row.payment)).toEqual(item.expectedPayments);
    }
  });

  it('conforms prepayment allocation cases', () => {
    for (const item of contract.prepayments) {
      const result = simulatePrepayment({
        ...item,
        loanType: item.loanType as 'French',
        strategy: item.strategy as 'ReducePayment',
        order: item.order as ('Arrears' | 'Fees' | 'Interest' | 'Principal')[],
      });
      expect(result.allocation).toEqual(item.expectedAllocation);
      expect(result.newPrincipal).toBe(item.expectedNewPrincipal);
      expect(result.newRemainingMonths).toBe(item.expectedRemainingMonths);
    }
  });
});
