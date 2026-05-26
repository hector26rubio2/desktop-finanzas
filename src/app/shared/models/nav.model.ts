import type { TranslationKey } from '../i18n/locale.types';

export interface NavItem {
  id: string;
  key: TranslationKey;
  icon: string;
  badge?: string;
  dot?: boolean;
  kbd?: string;
}

export interface NavGroup {
  key: TranslationKey;
  items: NavItem[];
}
