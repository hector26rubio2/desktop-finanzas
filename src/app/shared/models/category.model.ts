export interface CategoryResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'Income' | 'Expense';
  isDefault: boolean;
  createdAt: string;
}