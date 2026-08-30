import { ENTITY_FORM_SCHEMAS, EntityFormType } from './entity-form.schemas';

describe('entity form schema registry', () => {
  const types = Object.keys(ENTITY_FORM_SCHEMAS) as EntityFormType[];

  it('exposes a builder for every entity type', () => {
    expect(types).toEqual([
      'account',
      'loan',
      'creditCardTerms',
      'installment',
      'recurring',
      'investment',
      'valuation',
    ]);
  });

  it('every builder returns fields with a unique key, a label and a type', () => {
    for (const type of types) {
      const fields = ENTITY_FORM_SCHEMAS[type]({ baseCurrency: 'COP', accounts: [], categories: [] });
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every((f) => f.key && f.label && f.type)).toBe(true);
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('exposes the new domain fields (loan purpose/direction, recurring class, investment risk)', () => {
    const loanKeys = ENTITY_FORM_SCHEMAS.loan().map((f) => f.key);
    expect(loanKeys).toContain('purpose');
    expect(loanKeys).toContain('direction');
    expect(ENTITY_FORM_SCHEMAS.recurring().map((f) => f.key)).toContain('recurringType');
    expect(ENTITY_FORM_SCHEMAS.investment().map((f) => f.key)).toContain('riskLevel');
    expect(ENTITY_FORM_SCHEMAS.creditCardTerms().map((f) => f.key)).toContain('intlPurchaseApr');
  });

  it('conditional fields declare a visibility predicate', () => {
    const accountFields = ENTITY_FORM_SCHEMAS.account();
    const creditLimit = accountFields.find((f) => f.key === 'creditLimit');
    expect(creditLimit?.visibleWhen?.({ type: 'Credit' })).toBe(true);
    expect(creditLimit?.visibleWhen?.({ type: 'Cash' })).toBe(false);
  });

  it('caps percentage rates before they reach the data layer', () => {
    const accountRate = ENTITY_FORM_SCHEMAS.account().find((field) => field.key === 'interestRate');
    const loanRate = ENTITY_FORM_SCHEMAS.loan().find((field) => field.key === 'interestRateAnnual');
    const installmentRate = ENTITY_FORM_SCHEMAS.installment().find((field) => field.key === 'interestRatePercent');
    expect(accountRate?.max).toBe(1000);
    expect(loanRate?.max).toBe(1000);
    expect(installmentRate?.max).toBe(1000);
  });
});
