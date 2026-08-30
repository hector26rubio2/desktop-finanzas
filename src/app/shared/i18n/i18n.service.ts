import { Injectable, signal, computed, effect } from '@angular/core';
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

  private readonly supported = new Set<Locale>(['es-CO', 'en-US', 'pt-BR']);
  currentLocale = signal<Locale>(this.initialLocale());

  private translations = computed(() => this.locales[this.currentLocale()]);

  constructor() {
    effect(() => {
      document.documentElement.lang = this.currentLocale();
    });
  }

  setLocale(locale: Locale): void {
    if (!this.supported.has(locale)) return;
    this.currentLocale.set(locale);
    localStorage.setItem(this.STORAGE_KEY, locale);
  }

  t(key: TranslationKey): string;
  t(key: string): string;
  t(key: string): string {
    return this.translations()[key] ?? this.locales['es-CO'][key] ?? key;
  }

  localize(es: string, en: string, pt: string): string {
    return { 'es-CO': es, 'en-US': en, 'pt-BR': pt }[this.currentLocale()];
  }

  catName(name: string, translations: CategoryTranslations | null | undefined): string {
    if (!translations) return name;
    const locale = this.currentLocale();
    return translations[locale] ?? translations['es-CO'] ?? name;
  }

  private initialLocale(): Locale {
    const stored = localStorage.getItem(this.STORAGE_KEY) as Locale | null;
    return stored && this.supported.has(stored) ? stored : 'es-CO';
  }
}
