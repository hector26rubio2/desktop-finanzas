export type LoanPurpose = 'FreeInvestment' | 'Mortgage' | 'Vehicle' | 'Personal' | 'Education' | 'Other';
export type LoanDirection = 'Taken' | 'Given';

export interface LoanResponse {
  id: string;
  userId: string;
  description: string;
  party: string | null;
  purpose?: LoanPurpose | null;
  direction?: LoanDirection;
  principal: number;
  currency: string;
  trmApplied: number;
  interestRateAnnual: number;
  termMonths: number;
  startDate: string;
  loanType: 'French' | 'German' | 'American';
  accountId: string | null;
  isActive: boolean;
  paidMonths: number;
  remainingMonths: number;
  paidPrincipal: number;
  outstandingPrincipal: number;
  createdAt: string;
}

export interface LoanRequest {
  description: string;
  party?: string;
  purpose?: LoanPurpose | null;
  direction?: LoanDirection;
  principal: number;
  currency: string;
  trmApplied?: number;
  interestRateAnnual: number;
  termMonths: number;
  startDate: string;
  loanType?: 'French' | 'German' | 'American';
  accountId?: string;
}

export interface LoanAmortizationRow {
  number: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}
