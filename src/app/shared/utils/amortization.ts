export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export function toBase(amount: number, rate: number): number {
  if (amount <= 0 || rate <= 0) throw new RangeError('amount_and_rate_must_be_positive');
  return roundMoney(amount * rate);
}

export function buildAmortization(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string,
  type: 'French' | 'German' | 'American',
): AmortizationRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) {
    throw new RangeError('invalid_start_date');
  }
  const monthlyRate = annualRate / 100 / 12;
  const rows: AmortizationRow[] = [];
  if (principal <= 0 || annualRate < 0 || termMonths <= 0) throw new RangeError('invalid_loan_terms');
  let balance = roundMoney(principal);
  const frenchPayment =
    type === 'French'
      ? roundMoney(
          monthlyRate === 0
            ? balance / termMonths
            : (balance * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                (Math.pow(1 + monthlyRate, termMonths) - 1),
        )
      : 0;
  const germanPrincipal = type === 'German' ? roundMoney(balance / termMonths) : 0;
  for (let m = 1; m <= termMonths; m++) {
    const interest = roundMoney(balance * monthlyRate);
    let principalPortion =
      m === termMonths
        ? balance
        : type === 'French'
          ? Math.min(balance, roundMoney(frenchPayment - interest))
          : type === 'German'
            ? Math.min(balance, germanPrincipal)
            : 0;
    principalPortion = roundMoney(principalPortion);
    const payment = roundMoney(principalPortion + interest);
    balance = roundMoney(balance - principalPortion);
    rows.push({ month: m, payment, interest, principal: principalPortion, balance });
  }

  return rows;
}
