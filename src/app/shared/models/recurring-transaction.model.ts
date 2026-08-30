export type RecurrenceFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type MovementKind = 'Income' | 'Expense';
export type RecurringType = 'FixedExpense' | 'Subscription' | 'Rent' | 'Utility' | 'Salary' | 'Other';

export interface RecurringTransactionResponse {
  id: string;
  userId: string;
  type: MovementKind;
  recurringType?: RecurringType | null;
  amount: number;
  currency: string;
  trmApplied: number;
  categoryId: string | null;
  accountId: string | null;
  description: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

export interface RecurringTransactionRequest {
  type: MovementKind;
  recurringType?: RecurringType | null;
  amount: number;
  currency: string;
  trmApplied?: number;
  categoryId?: string;
  accountId?: string;
  description?: string;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  startDate: string;
  endDate?: string | null;
}
