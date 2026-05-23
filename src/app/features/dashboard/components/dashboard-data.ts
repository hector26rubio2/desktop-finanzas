export type Granularity = 'day' | 'week' | 'month' | 'year';
export type TypeFilter = 'all' | 'Income' | 'Expense';

export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

export interface CategoryExpense {
  name: string;
  total: number;
}

export interface RecentMovement {
  id: string;
  date: string;
  description: string | null;
  type: 'Income' | 'Expense';
  currency: string;
  amount: number;
  amountBase: number;
  categoryName: string | null;
  categoryColor: string | null;
}