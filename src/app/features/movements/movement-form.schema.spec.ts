import { describe, expect, it } from 'vitest';
import { isGenericMovementSource, movementFormFields } from './movement-form.schema';
const fields = movementFormFields({ categories: [], accounts: [], baseCurrency: 'COP' });
const visible = (key: string, v: Record<string, unknown>) =>
  fields.find((x) => x.key === key)?.visibleWhen?.(v) ?? true;
describe('movement dynamic schema', () => {
  it('shows financial conditional fields', () => {
    expect(visible('trmApplied', { currency: 'USD' })).toBe(true);
    expect(visible('trmApplied', { currency: 'COP' })).toBe(false);
    expect(visible('loanInstallments', { sourceType: 'CreditCard' })).toBe(true);
    expect(visible('loanInstallments', { sourceType: 'Loan' })).toBe(false);
    expect(visible('recFrequency', { isRecurring: false })).toBe(false);
  });
  it('excludes unmanaged loans from the generic movement form', () => {
    const source = fields.find((field) => field.key === 'sourceType');
    expect(source?.options?.map((option) => option.value)).toEqual(['Cash', 'OwnAccount', 'CreditCard']);
    expect(fields.some((field) => field.key === 'loanParty')).toBe(false);
    expect(isGenericMovementSource('Loan')).toBe(false);
  });
  it('uses the same keys for create and edit FormGroup', () => {
    expect(fields.map((x) => x.key)).toContain('amount');
    expect(new Set(fields.map((x) => x.key)).size).toBe(fields.length);
  });
});
