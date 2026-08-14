import { describe, it, expect } from 'vitest';
import { parseDate, toDateKey, toMonthKey, getMonthKey, formatDateTime, range } from './date';

describe('toDateKey / toMonthKey / getMonthKey', () => {
  it('toDateKey produce YYYY-MM-DD con padding', () => {
    expect(toDateKey(new Date(2026, 5, 7))).toBe('2026-06-07');
  });
  it('toMonthKey produce YYYY-MM', () => {
    expect(toMonthKey(new Date(2026, 5, 17))).toBe('2026-06');
  });
  it('getMonthKey usa month 0-based', () => {
    expect(getMonthKey(2026, 5)).toBe('2026-06');
  });
});

describe('parseDate', () => {
  it('parsea ISO YYYY-MM-DD a mediodía local', () => {
    const d = parseDate('2026-06-17');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(17);
  });
  it('parsea formato day-first DD/MM/YYYY', () => {
    const d = parseDate('17/06/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(17);
  });
});

describe('formatDateTime', () => {
  it('formatea fecha + hora (en-US)', () => {
    expect(formatDateTime('2026-06-17T14:30:00', 'en-US')).toBe('Jun 17 14:30');
  });
  it('devuelve el string original si la fecha es inválida', () => {
    expect(formatDateTime('no-es-fecha', 'en-US')).toBe('no-es-fecha');
  });
});

describe('range', () => {
  it('genera 0..n-1', () => {
    expect(range(3)).toEqual([0, 1, 2]);
  });
  it('respeta el máximo', () => {
    expect(range(50, 5)).toHaveLength(5);
  });
});
