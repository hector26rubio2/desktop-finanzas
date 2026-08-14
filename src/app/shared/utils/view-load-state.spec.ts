import { describe, expect, it } from 'vitest';
import { resolveViewLoadState } from './view-load-state';

describe('resolveViewLoadState', () => {
  it('keeps loading separate and gives it priority while a request is in flight', () => {
    expect(resolveViewLoadState(true, true, 0)).toBe('loading');
  });

  it('shows an error instead of a misleading empty state', () => {
    expect(resolveViewLoadState(false, true, 0)).toBe('error');
    expect(resolveViewLoadState(false, true, 3)).toBe('error');
  });

  it('only reports empty after a successful load with no items', () => {
    expect(resolveViewLoadState(false, false, 0)).toBe('empty');
  });

  it('reports ready after a successful load with data', () => {
    expect(resolveViewLoadState(false, false, 1)).toBe('ready');
  });
});
