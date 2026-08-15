export interface AccountResponse {
  id: string;
  name: string;
  type: 'Cash' | 'Debit' | 'Credit';
  currency: string;
  bank: string | null;
  lastFour: string | null;
  creditLimit: number | null;
  billingDay: number | null;
  paymentDay: number | null;
  interestRate: number | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AccountRequest {
  name: string;
  type: 'Cash' | 'Debit' | 'Credit';
  currency: string;
  bank?: string;
  lastFour?: string;
  creditLimit?: number;
  billingDay?: number;
  paymentDay?: number;
  interestRate?: number;
  isDefault?: boolean;
}

export interface AccountBalance {
  balance: number;
  balanceBase?: number;
  outstandingDebt?: number;
  outstandingDebtBase?: number;
  cycleSpend?: number;
  cycleSpendBase?: number;

  usedInCycle: number;

  usedInCycleBase?: number;
}
