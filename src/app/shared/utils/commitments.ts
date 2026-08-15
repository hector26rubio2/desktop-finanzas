import { buildAmortization } from './amortization';
import type { InstallmentResponse } from '../models/installment.model';
import type { LoanResponse } from '../models/loan.model';

export function monthlyInstallmentCommitment(installments: readonly InstallmentResponse[]): number {
  return installments
    .filter((x) => x.isActive && x.paidCount < x.installmentsCount)
    .reduce((total, x) => total + Number(x.monthlyAmount || 0) * Number(x.trmApplied || 1), 0);
}

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

export function monthlyDebtService(
  installments: readonly InstallmentResponse[],
  loans: readonly LoanResponse[],
): number {
  return monthlyInstallmentCommitment(installments) + monthlyLoanCommitment(loans);
}
