import type { TranslationKey } from '../shared/i18n/locale.types';

export interface AppNavigationItem {
  id: string;
  key: TranslationKey;
  icon: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  kbd?: string;
  badge?: string;
  dot?: boolean;
}

export interface AppNavigationGroup {
  key: TranslationKey;
  items: readonly AppNavigationItem[];
}

export const APP_NAVIGATION_GROUPS: readonly AppNavigationGroup[] = [
  {
    key: 'nav.dashboard',
    items: [
      {
        id: 'dashboard',
        key: 'nav.dashboard',
        icon: 'dashboard',
        titleKey: 'header.dashboard',
        subtitleKey: 'header_sub.dashboard',
        kbd: 'g d',
      },
    ],
  },
  {
    key: 'nav.movements',
    items: [
      {
        id: 'movements',
        key: 'nav.movements',
        icon: 'list',
        titleKey: 'header.movements',
        subtitleKey: 'header_sub.movements',
        kbd: 'g m',
      },
      {
        id: 'recurring',
        key: 'nav.recurring',
        icon: 'list',
        titleKey: 'header.recurring',
        subtitleKey: 'header_sub.recurring',
      },
      {
        id: 'calendar',
        key: 'nav.calendar',
        icon: 'calendar',
        titleKey: 'header.calendar',
        subtitleKey: 'header_sub.calendar',
      },
    ],
  },
  {
    key: 'header.portfolio',
    items: [
      {
        id: 'accounts',
        key: 'nav.accounts',
        icon: 'account',
        titleKey: 'header.accounts',
        subtitleKey: 'header_sub.accounts',
        kbd: 'g a',
      },
      {
        id: 'cards',
        key: 'nav.cards',
        icon: 'card',
        titleKey: 'header.cards',
        subtitleKey: 'header_sub.cards',
        kbd: 'g t',
      },
      {
        id: 'installments',
        key: 'nav.installments',
        icon: 'calendar',
        titleKey: 'header.installments',
        subtitleKey: 'header_sub.installments',
      },
      {
        id: 'loans',
        key: 'nav.loans',
        icon: 'loan',
        titleKey: 'header.loans',
        subtitleKey: 'header_sub.loans',
      },
      {
        id: 'portfolio',
        key: 'nav.portfolio',
        icon: 'dashboard',
        titleKey: 'header.portfolio',
        subtitleKey: 'header_sub.portfolio',
      },
    ],
  },
  {
    key: 'nav.reports',
    items: [
      {
        id: 'reports',
        key: 'nav.reports',
        icon: 'reports',
        titleKey: 'header.reports',
        subtitleKey: 'header_sub.reports',
        kbd: 'g r',
      },
    ],
  },
  {
    key: 'nav.settings',
    items: [
      {
        id: 'categories',
        key: 'nav.categories',
        icon: 'category',
        titleKey: 'header.categories',
        subtitleKey: 'header_sub.categories',
        kbd: 'g k',
      },
      {
        id: 'platform-tools',
        key: 'nav.data_tools',
        icon: 'reports',
        titleKey: 'header.platform_tools',
        subtitleKey: 'header_sub.platform_tools',
      },
      {
        id: 'settings',
        key: 'nav.settings',
        icon: 'settings',
        titleKey: 'header.settings',
        subtitleKey: 'header_sub.settings',
        kbd: 'g s',
      },
    ],
  },
];

export const APP_NAVIGATION_ITEMS: readonly AppNavigationItem[] = APP_NAVIGATION_GROUPS.flatMap((group) => group.items);

export const APP_NAVIGATION_BY_ID = new Map(APP_NAVIGATION_ITEMS.map((item) => [item.id, item]));
