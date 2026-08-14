import { describe, expect, it } from 'vitest';
import { LOCAL_CAPABILITIES } from './platform.service';

describe('capability fallback', () => {
  it('fails closed for unknown capabilities', () => {
    expect(LOCAL_CAPABILITIES['sync'] === true).toBe(false);
    expect(LOCAL_CAPABILITIES['core-finance']).toBe(true);
  });

  it('advertises only implemented local capabilities', () => {
    expect(LOCAL_CAPABILITIES).not.toHaveProperty('budgets');
    expect(LOCAL_CAPABILITIES).not.toHaveProperty('planning');
    expect(LOCAL_CAPABILITIES).not.toHaveProperty('licenses');
  });
});
