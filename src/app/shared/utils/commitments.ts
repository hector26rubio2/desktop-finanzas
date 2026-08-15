import { buildAmortization } from './amortization';
import type { InstallmentResponse } from '../models/installment.model';
import type { LoanResponse } from '../models/loan.model';

/**
 * Compromiso mensual: lo que hay que pagar este mes por compras a cuotas y
 * préstamos, en moneda base.
 *
 * Existe como fuente única porque estaba calculado dos veces con convenciones
 * distintas: el dashboard derivaba la cuota del préstamo con `buildAmortization`
 * (tasa nominal, anual/12) y reportes la recalculaba a mano con tasa efectiva
 * ((1+r)^(1/12)-1). Para el mismo préstamo las dos pantallas mostraban cifras
 * distintas. Gana la vía del dashboard: es la que audita `financial-api`.
 */

/** Un plan de cuotas cuenta si sigue vivo; `isActive` ya se apaga al pagar la última. */
export function monthlyInstallmentCommitment(installments: readonly InstallmentResponse[]): number {
  return installments
    .filter((x) => x.isActive && x.paidCount < x.installmentsCount)
    .reduce((total, x) => total + Number(x.monthlyAmount || 0) * Number(x.trmApplied || 1), 0);
}

/**
 * `buildAmortization` lanza con principal o plazo no positivos, así que los
 * préstamos ya liquidados se filtran antes de llegar a ella.
 */
export function monthlyLoanCommitment(loans: readonly LoanResponse[]): number {
  return loans
    .filter((x) => x.isActive && x.remainingMonths > 0 && x.outstandingPrincipal > 0)
    .reduce((total, x) => {
      const payment =
        buildAmortization(x.outstandingPrincipal, x.interestRateAnnual, x.remainingMonths, x.startDate, x.loanType)[0]
          ?.payment ?? 0;
      return total + payment * Number(x.trmApplied || 1);
    }, 0);
}

/** Servicio mensual de deuda = cuotas + préstamos. */
export function monthlyDebtService(
  installments: readonly InstallmentResponse[],
  loans: readonly LoanResponse[],
): number {
  return monthlyInstallmentCommitment(installments) + monthlyLoanCommitment(loans);
}
