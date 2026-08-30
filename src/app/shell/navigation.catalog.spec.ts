import { APP_NAVIGATION_BY_ID, APP_NAVIGATION_ITEMS } from './navigation.catalog';

describe('application navigation catalog', () => {
  it('provides a title and subtitle for every visible destination', () => {
    expect(APP_NAVIGATION_ITEMS.every((item) => item.titleKey && item.subtitleKey)).toBe(true);
  });

  it('includes the completed local views and excludes simulated admin', () => {
    expect(APP_NAVIGATION_BY_ID.has('portfolio')).toBe(true);
    expect(APP_NAVIGATION_BY_ID.has('platform-tools')).toBe(true);
    expect(APP_NAVIGATION_BY_ID.has('recurring')).toBe(true);
    expect(APP_NAVIGATION_BY_ID.has('installments')).toBe(true);
    expect(APP_NAVIGATION_BY_ID.has('admin')).toBe(false);
  });

  it('has unique route identifiers', () => {
    const ids = APP_NAVIGATION_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
