import { Injectable, signal, computed } from '@angular/core';
import type { Locale, TranslationKey } from './locale.types';
import es from './translations/es-AR';
import en from './translations/en-US';
import pt from './translations/pt-BR';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly STORAGE_KEY = 'finanzas-locale';
  private locales: Record<Locale, Record<TranslationKey, string>> = {
    'es-AR': es,
    'en-US': en,
    'pt-BR': pt,
  };

  currentLocale = signal<Locale>((localStorage.getItem(this.STORAGE_KEY) as Locale) || 'es-AR');

  private translations = computed(() => this.locales[this.currentLocale()]);

  setLocale(locale: Locale): void {
    this.currentLocale.set(locale);
    localStorage.setItem(this.STORAGE_KEY, locale);
  }

  t(key: TranslationKey): string {
    return this.translations()[key] ?? this.locales['es-AR'][key] ?? key;
  }
}
