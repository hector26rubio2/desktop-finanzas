import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth/auth.service';
import { ThemeService, Theme } from '../../shared/services/theme.service';
import { PlatformService } from '../../shared/services/platform.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { Locale, TranslationKey } from '../../shared/i18n/locale.types';

type Section = 'perfil' | 'apariencia' | 'monedas' | 'atajos' | 'acerca';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  locales = [
    { id: 'es-CO' as Locale, key: 'settings.es' as const },
    { id: 'en-US' as Locale, key: 'settings.en' as const },
    { id: 'pt-BR' as Locale, key: 'settings.pt' as const },
  ];

  activeSection = signal<Section>('apariencia');

  sections: { id: Section; labelKey: TranslationKey }[] = [
    { id: 'perfil', labelKey: 'settings.profile' },
    { id: 'apariencia', labelKey: 'settings.appearance' },
    { id: 'monedas', labelKey: 'settings.currencies' },
    { id: 'atajos', labelKey: 'settings.shortcuts' },
    { id: 'acerca', labelKey: 'settings.about' },
  ];

  themeOptions: { id: Theme; name: string; bg: string; accent: string }[] = [
    { id: 'obsidian', name: 'Obsidiana', bg: 'oklch(13% 0.006 70)', accent: 'oklch(80% 0.12 78)' },
    { id: 'midnight', name: 'Medianoche', bg: 'oklch(13% 0.035 255)', accent: 'oklch(74% 0.16 245)' },
    { id: 'emerald', name: 'Esmeralda', bg: 'oklch(15% 0.020 175)', accent: 'oklch(74% 0.15 162)' },
    { id: 'institutional', name: 'Institución', bg: 'oklch(7.5% 0.004 192)', accent: 'oklch(77.4% 0.052 228)' },
    { id: 'espresso', name: 'Espresso', bg: 'oklch(7.7% 0.002 80)', accent: 'oklch(77.6% 0.033 23)' },
    { id: 'pulse', name: 'Pulso', bg: 'oklch(7.3% 0.019 222)', accent: 'oklch(77.3% 0.048 261)' },
    { id: 'claro', name: 'Claro', bg: 'oklch(98% 0.004 80)', accent: 'oklch(48% 0.18 245)' },
    {
      id: 'institutional-light',
      name: 'Institución Claro',
      bg: 'oklch(97.5% 0.003 210)',
      accent: 'oklch(22.7% 0.076 224)',
    },
    { id: 'espresso-light', name: 'Espresso Claro', bg: 'oklch(97.8% 0.006 37)', accent: 'oklch(18.0% 0.021 24)' },
    { id: 'pulse-light', name: 'Pulso Claro', bg: 'oklch(97.6% 0.005 257)', accent: 'oklch(22.0% 0.105 263)' },
  ];

  newThemeName = '';
  newThemeAccent = '#3b82f6';
  newThemeBg = '#f8f8f6';
  newThemeIsDark = false;

  activeCustomName() {
    return localStorage.getItem('active-custom-theme') ?? '';
  }

  saveCustomTheme() {
    if (!this.newThemeName.trim()) return;
    this.theme.saveCustomTheme({
      name: this.newThemeName.trim(),
      isDark: this.newThemeIsDark,
      accent: this.newThemeAccent,
      bg: this.newThemeBg,
    });
    this.newThemeName = '';
  }

  currencies = [
    { code: 'ARS', name: 'Peso argentino', symbol: '$' },
    { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'COP', name: 'Peso colombiano', symbol: 'COP' },
  ];

  get shortcuts() {
    const m = this.os.mod;
    return [
      { action: 'Command palette', keys: `${m} K` },
      { action: 'New transaction', keys: `${m} N` },
      { action: 'Change theme', keys: `${m} ;` },
      { action: 'Search', keys: `${m} F` },
      { action: 'Go to Dashboard', keys: 'g d' },
      { action: 'Go to Movements', keys: 'g m' },
      { action: 'Go to Accounts', keys: 'g a' },
      { action: 'Go to Cards', keys: 'g t' },
      { action: 'Go to Reports', keys: 'g r' },
      { action: 'Go to Settings', keys: 'g s' },
    ];
  }

  userName = () => this.auth.currentUser()?.name ?? this.i18n.t('auth.name');
  userEmail = () => this.auth.currentUser()?.email ?? '';
  userRole = () => this.auth.currentUser()?.role ?? 'User';
  baseCurrency = () => this.auth.currentUser()?.baseCurrency ?? 'ARS';
  userInitials = () => {
    const n = this.auth.currentUser()?.name ?? 'U';
    return n
      .split(' ')
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join('');
  };

  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public os = inject(PlatformService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  logout() {
    this.auth.logout();
  }
}
