import { describe, it, expect } from 'vitest';
import { monthlyInstallmentCommitment, monthlyLoanCommitment, monthlyDebtService } from './commitments';
import { buildAmortization } from './amortization';
import type { InstallmentResponse } from '../models/installment.model';
import type { LoanResponse } from '../models/loan.model';

const installment = (over: Partial<InstallmentResponse> = {}): InstallmentResponse =>
  ({
    id: 'i1',
    description: 'Compra',
    currency: 'COP',
    trmApplied: 1,
    totalAmount: 1200,
    monthlyAmount: 100,
    remainingAmount: 1200,
    installmentsCount: 12,
    paidCount: 0,
    isActive: true,
    ...over,
  }) as InstallmentResponse;

const loan = (over: Partial<LoanResponse> = {}): LoanResponse =>
  ({
    id: 'l1',
    description: 'Préstamo',
    principal: 1_000_000,
    currency: 'COP',
    trmApplied: 1,
    interestRateAnnual: 12,
    termMonths: 24,
    startDate: '2026-01-01',
    loanType: 'French',
    isActive: true,
    paidMonths: 0,
    remainingMonths: 24,
    paidPrincipal: 0,
    outstandingPrincipal: 1_000_000,
    ...over,
  }) as LoanResponse;

describe('monthlyInstallmentCommitment', () => {
  it('suma la cuota mensual convertida a moneda base', () => {
    const total = monthlyInstallmentCommitment([
      installment({ monthlyAmount: 100, trmApplied: 1 }),
      installment({ id: 'i2', monthlyAmount: 50, trmApplied: 4000, currency: 'USD' }),
    ]);
    expect(total).toBe(100 + 50 * 4000);
  });

  it('ignora los planes ya terminados aunque sigan marcados activos', () => {
    const total = monthlyInstallmentCommitment([
      installment({ paidCount: 12, installmentsCount: 12, isActive: true }),
      installment({ id: 'i2', isActive: false }),
    ]);
    expect(total).toBe(0);
  });
});

describe('monthlyLoanCommitment', () => {
  it('usa la cuota de buildAmortization, no una fórmula propia', () => {
    const l = loan();
    const expected = buildAmortization(
      l.outstandingPrincipal,
      l.interestRateAnnual,
      l.remainingMonths,
      l.startDate,
      l.loanType,
    )[0].payment;
    expect(monthlyLoanCommitment([l])).toBe(expected);
  });

  it('convierte la cuota a moneda base con la TRM del préstamo', () => {
    const base = monthlyLoanCommitment([loan()]);
    expect(monthlyLoanCommitment([loan({ trmApplied: 4000 })])).toBeCloseTo(base * 4000, 6);
  });

  it('no lanza con un préstamo ya liquidado: lo filtra antes de amortizar', () => {
    const liquidado = loan({ outstandingPrincipal: 0, remainingMonths: 0, isActive: false });
    expect(() => monthlyLoanCommitment([liquidado])).not.toThrow();
    expect(monthlyLoanCommitment([liquidado])).toBe(0);
  });

  it('con interés cero reparte el principal en el plazo restante', () => {
    const sinInteres = loan({ interestRateAnnual: 0, outstandingPrincipal: 1200, remainingMonths: 12 });
    expect(monthlyLoanCommitment([sinInteres])).toBe(100);
  });
});

describe('monthlyDebtService', () => {
  it('es la suma de cuotas y préstamos', () => {
    const insts = [installment()];
    const loans = [loan()];
    expect(monthlyDebtService(insts, loans)).toBe(monthlyInstallmentCommitment(insts) + monthlyLoanCommitment(loans));
  });

  it('sin deuda devuelve cero', () => {
    expect(monthlyDebtService([], [])).toBe(0);
  });
});
