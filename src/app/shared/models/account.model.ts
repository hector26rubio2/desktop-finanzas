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
}

export interface AccountBalance {
  balance: number;
  usedInCycle: number;
}