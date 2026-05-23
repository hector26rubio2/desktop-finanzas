export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function buildAmortization(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string,
  type: 'French' | 'German' | 'American',
): AmortizationRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const rows: AmortizationRow[] = [];
  let balance = principal;

  if (type === 'French') {
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    for (let m = 1; m <= termMonths; m++) {
      const interest = balance * monthlyRate;
      const principalPortion = payment - interest;
      balance = Math.max(0, balance - principalPortion);
      rows.push({ month: m, payment, interest, principal: principalPortion, balance });
    }
  } else if (type === 'German') {
    const principalPortion = principal / termMonths;
    for (let m = 1; m <= termMonths; m++) {
      const interest = balance * monthlyRate;
      const payment = principalPortion + interest;
      balance = Math.max(0, balance - principalPortion);
      rows.push({ month: m, payment, interest, principal: principalPortion, balance });
    }
  } else {
    const interestOnly = principal * monthlyRate;
    for (let m = 1; m <= termMonths; m++) {
      const principalPortion = m === termMonths ? principal : 0;
      const payment = interestOnly + principalPortion;
      rows.push({ month: m, payment, interest: interestOnly, principal: principalPortion, balance: m === termMonths ? 0 : principal });
    }
  }

  return rows;
}