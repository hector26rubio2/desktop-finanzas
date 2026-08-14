import { roundMoney } from './amortization';

export type PaymentBucket = 'Arrears' | 'Fees' | 'Interest' | 'Principal';
export type PrepaymentStrategy = 'ReducePayment' | 'ReduceTerm';

export function simulatePrepayment(input: {
  outstandingPrincipal: number;
  annualRatePercent: number;
  remainingMonths: number;
  loanType: 'French' | 'German' | 'American';
  paymentAmount: number;
  arrears: number;
  fees: number;
  accruedInterest: number;
  order: PaymentBucket[];
  strategy: PrepaymentStrategy;
}) {
  if (input.paymentAmount <= 0 || input.remainingMonths <= 0 || new Set(input.order).size !== 4)
    throw new RangeError('invalid_prepayment');
  let available = roundMoney(input.paymentAmount);
  const due: Record<PaymentBucket, number> = {
    Arrears: input.arrears,
    Fees: input.fees,
    Interest: input.accruedInterest,
    Principal: input.outstandingPrincipal,
  };
  const allocation: Record<PaymentBucket, number> = { Arrears: 0, Fees: 0, Interest: 0, Principal: 0 };
  for (const bucket of input.order) {
    allocation[bucket] = Math.min(available, roundMoney(due[bucket]));
    available = roundMoney(available - allocation[bucket]);
  }
  const newPrincipal = roundMoney(input.outstandingPrincipal - allocation.Principal);
  return {
    allocation: {
      arrears: allocation.Arrears,
      fees: allocation.Fees,
      interest: allocation.Interest,
      principal: allocation.Principal,
      unapplied: available,
    },
    newPrincipal,
    newRemainingMonths: newPrincipal <= 0 ? 0 : input.remainingMonths,
  };
}
