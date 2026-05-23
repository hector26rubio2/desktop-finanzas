export interface MovementResponse {
  id: string;
  type: 'Income' | 'Expense';
  subType: 'Income' | 'Expense' | 'LoanReceived' | 'LoanGiven' | 'Saving' | null;
  sourceType: 'Cash' | 'OwnAccount' | 'CreditCard' | 'Loan' | null;
  loanParty: string | null;
  amount: number;
  currency: string;
  trmApplied: number;
  amountBase: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
  createdAt: string;
}

export interface MovementRequest {
  type: 'Income' | 'Expense';
  subType?: string;
  sourceType?: string;
  loanParty?: string;
  amount: number;
  currency: string;
  trmApplied: number;
  date: string;
  description?: string;
  categoryId?: string;
  accountId?: string;
}

export interface MovementSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  comparedToPreviousMonth: { incomeDelta: number; expenseDelta: number };
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}