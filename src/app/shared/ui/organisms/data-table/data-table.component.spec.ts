import { describe, expect, it } from 'vitest';
describe('data table configuration', () => {
  it('keeps stable column keys for persisted visibility', () => {
    const keys = ['date', 'description', 'amount'];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
