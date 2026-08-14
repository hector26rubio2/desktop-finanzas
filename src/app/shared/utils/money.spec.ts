import { describe, it, expect } from 'vitest';
import { formatMoney, formatAmount } from './money';

// Locale fijo en-US en las aserciones exactas para evitar variabilidad de ICU.
describe('formatMoney', () => {
  it('formatea sin decimales por defecto e incluye el código de moneda', () => {
    expect(formatMoney(1234567, 'COP', { locale: 'en-US' })).toBe('1,234,567 COP');
  });

  it('respeta los decimales solicitados', () => {
    expect(formatMoney(1000.5, 'USD', { locale: 'en-US', decimals: 2 })).toBe('1,000.50 USD');
  });

  it('siempre termina con el código de moneda', () => {
    expect(formatMoney(10, 'EUR')).toMatch(/ EUR$/);
  });
});

describe('formatAmount', () => {
  it('formatea solo el número, sin moneda', () => {
    expect(formatAmount(1234567, { locale: 'en-US' })).toBe('1,234,567');
  });
});
