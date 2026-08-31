import type { DynamicField } from '../../shared/ui/organisms/dynamic-form/dynamic-form.component';
import { transactionCoreFormFields } from '../../shared/forms/entity-form.schemas';

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
    ...transactionCoreFormFields({ ...o, includeSource: true, includeDate: true }),
    {
      key: 'loanInstallments',
      label: 'Cuotas',
      type: 'number',
      section: 'Crédito',
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
    { key: 'isRecurring', label: 'Recurrente', type: 'checkbox', section: 'Programación' },
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
