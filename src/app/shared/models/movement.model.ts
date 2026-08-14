export interface MovementResponse {
  id: string;
  type: 'Income' | 'Expense';
  subType: 'Income' | 'Expense' | 'LoanReceived' | 'LoanGiven' | 'Saving' | null;
  sourceType: 'Cash' | 'OwnAccount' | 'CreditCard' | 'Loan' | null;
  loanParty: string | null;
  loanInstallments: number | null;
  loanInterestRate: number | null;
  amount: number;
  currency: string;
  trmApplied: number;
  amountBase: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountId: string | null;
  accountName: string | null;
  installmentPurchaseId: string | null;
  loanId?: string | null;
  principalComponent?: number | null;
  interestComponent?: number | null;
  installmentNumber?: number | null;
  recurringTransactionId?: string | null;
  portfolioEntityId?: string | null;
  portfolioType?: string | null;
  investmentTransactionType?: 'Contribution' | 'Withdrawal' | 'Buy' | 'Sell' | 'Fee' | null;
  operationId: string | null;
  operationType: 'Transfer' | 'CreditPurchase' | 'CreditInterest' | 'CreditPayment' | 'LoanDisbursement' | 'LoanPayment' | 'Saving' | null;
  createdAt: string;
}

export interface MovementRequest {
  type: 'Income' | 'Expense';
  subType?: string;
  sourceType?: string;
  loanParty?: string;
  loanInstallments?: number;
  loanInterestRate?: number;
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
  savings: number;
  savingsRate: number;
  comparedToPreviousMonth: { incomeDelta: number; expenseDelta: number };
}

export interface TransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  trmApplied: number;
  date: string;
  description?: string;
  isSaving: boolean;
}

export interface TransferResponse {
  operationId: string;
  sourceMovementId: string;
  destinationMovementId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  amountBase: number;
  date: string;
  isSaving: boolean;
}

export interface CreditCardPaymentRequest {
  sourceAccountId: string;
  creditAccountId: string;
  amount: number;
  currency: string;
  trmApplied: number;
  date: string;
  description?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
