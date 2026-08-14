import type { DynamicField } from '../../shared/ui/organisms/dynamic-form/dynamic-form.component';

export type GenericMovementSource = 'Cash' | 'OwnAccount' | 'CreditCard';

export function isGenericMovementSource(value: unknown): value is GenericMovementSource {
  return value === 'Cash' || value === 'OwnAccount' || value === 'CreditCard';
}

export interface MovementFormOptions {
  categories: Array<{ value: string; label: string }>;
  accounts: Array<{ value: string; label: string }>;
  baseCurrency: string;
}
export function movementFormFields(o: MovementFormOptions): DynamicField[] {
  return [
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'Expense', label: 'Gasto' },
        { value: 'Income', label: 'Ingreso' },
      ],
    },
    {
      key: 'sourceType',
      label: 'Origen',
      type: 'select',
      options: [
        { value: 'Cash', label: 'Efectivo' },
        { value: 'OwnAccount', label: 'Cuenta propia' },
        { value: 'CreditCard', label: 'Tarjeta de crédito' },
      ],
      visibleWhen: (v) => v['type'] === 'Expense' || v['sourceType'] !== 'CreditCard',
    },
    { key: 'amount', label: 'Monto', type: 'number', min: 0.01, step: 0.01 },
    {
      key: 'currency',
      label: 'Moneda',
      type: 'select',
      options: ['COP', 'ARS', 'USD', 'EUR'].map((value) => ({ value, label: value })),
    },
    {
      key: 'trmApplied',
      label: `TRM a ${o.baseCurrency}`,
      type: 'number',
      min: 0.000001,
      step: 0.000001,
      visibleWhen: (v) => v['currency'] !== o.baseCurrency,
    },
    { key: 'date', label: 'Fecha', type: 'datetime-local' },
    { key: 'description', label: 'Concepto', type: 'text' },
    {
      key: 'categoryId',
      label: 'Categoría',
      type: 'select',
      options: [{ value: '', label: 'Sin categoría' }, ...o.categories],
    },
    {
      key: 'accountId',
      label: 'Cuenta',
      type: 'select',
      options: [{ value: '', label: 'Sin cuenta' }, ...o.accounts],
    },
    {
      key: 'loanInstallments',
      label: 'Cuotas',
      type: 'number',
      min: 1,
      max: 36,
      visibleWhen: (v) => v['sourceType'] === 'CreditCard',
    },
    {
      key: 'loanInterestRate',
      label: 'Tasa de interés (%)',
      type: 'number',
      min: 0,
      visibleWhen: (v) => v['sourceType'] === 'CreditCard',
    },
    { key: 'isRecurring', label: 'Recurrente', type: 'checkbox' },
    {
      key: 'recFrequency',
      label: 'Frecuencia',
      type: 'select',
      options: ['Daily', 'Weekly', 'Monthly', 'Yearly'].map((value) => ({ value, label: value })),
      visibleWhen: (v) => v['isRecurring'] === true,
    },
    { key: 'recInterval', label: 'Cada', type: 'number', min: 1, visibleWhen: (v) => v['isRecurring'] === true },
    {
      key: 'recDayOfMonth',
      label: 'Día del mes',
      type: 'number',
      min: 1,
      max: 31,
      visibleWhen: (v) => v['isRecurring'] === true && v['recFrequency'] === 'Monthly',
    },
    { key: 'recEndDate', label: 'Fin', type: 'date', visibleWhen: (v) => v['isRecurring'] === true },
  ];
}
