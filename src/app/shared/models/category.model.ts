export interface CategoryTranslations {
  'es-CO'?: string;
  'en-US'?: string;
  'pt-BR'?: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'Income' | 'Expense';
  translations: CategoryTranslations | null;
  isDefault: boolean;
  createdAt: string;
}