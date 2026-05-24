import { Injectable, signal, computed } from '@angular/core';
import type { Locale, TranslationKey } from './locale.types';
import type { CategoryTranslations } from '../models/category.model';
import es from './translations/es-CO';
import en from './translations/en-US';
import pt from './translations/pt-BR';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly STORAGE_KEY = 'finanzas-locale';
  private locales: Record<Locale, Record<string, string>> = {
    'es-CO': es,
    'en-US': en,
    'pt-BR': pt,
  };

  currentLocale = signal<Locale>((localStorage.getItem(this.STORAGE_KEY) as Locale) || 'es-CO');

  private translations = computed(() => this.locales[this.currentLocale()]);

  setLocale(locale: Locale): void {
    this.currentLocale.set(locale);
    localStorage.setItem(this.STORAGE_KEY, locale);
  }

  t(key: TranslationKey): string;
  t(key: string): string;
  t(key: string): string {
    return this.translations()[key] ?? this.locales['es-CO'][key] ?? key;
  }

  catName(name: string, translations: CategoryTranslations | null | undefined): string {
    if (!translations) return name;
    const locale = this.currentLocale();
    return translations[locale] ?? translations['es-CO'] ?? name;
  }
}
