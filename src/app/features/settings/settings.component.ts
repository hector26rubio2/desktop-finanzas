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

  private triadicFrom(hex: string, offset: number): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (max === min) return '#666666';
    let h = 0;
    if (max === r) h = 60 * ((g - b) / (max - min) + (g < b ? 6 : 0));
    else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
    else h = 60 * ((r - g) / (max - min) + 4);
    const s = (max - min) / max;
    const l = (max + min) / 2;
    const h2 = (((h + offset) % 360) + 360) % 360;
    const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
    const m1 = 2 * l - m2;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const r2 = hue2rgb(m1, m2, h2 / 360 + 1 / 3);
    const g2 = hue2rgb(m1, m2, h2 / 360);
    const b2 = hue2rgb(m1, m2, h2 / 360 - 1 / 3);
    return (
      '#' +
      [r2, g2, b2]
        .map((c) =>
          Math.round(c * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  }

  saveCustomTheme() {
    if (!this.newThemeName.trim()) return;
    this.theme.saveCustomTheme({
      name: this.newThemeName.trim(),
      isDark: this.newThemeIsDark,
      accent: this.newThemeAccent,
      accent2: this.triadicFrom(this.newThemeAccent, 120),
      accent3: this.triadicFrom(this.newThemeAccent, 240),
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
