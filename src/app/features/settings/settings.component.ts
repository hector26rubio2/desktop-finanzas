import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  DestroyRef,
  viewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/services/auth/auth.service';
import { ThemeService, Theme, THEME_PRESETS, FONT_OPTIONS } from '../../shared/services/theme.service';
import { PlatformService } from '../../shared/services/platform.service';
import { UpdateService } from '../../shared/services/update/update.service';
import { DataTableComponent, ColumnDef } from '@ui/organisms/data-table/data-table.component';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { Locale, TranslationKey } from '../../shared/i18n/locale.types';

type Section = 'ajustes' | 'perfil' | 'apariencia' | 'atajos' | 'acerca';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  locales = [
    { id: 'es-CO' as Locale, key: 'settings.es' as const },
    { id: 'en-US' as Locale, key: 'settings.en' as const },
    { id: 'pt-BR' as Locale, key: 'settings.pt' as const },
  ];

  langs = [
    { id: 'es-CO' as Locale, label: 'Español', flag: '🇨🇴' },
    { id: 'en-US' as Locale, label: 'English', flag: '🇺🇸' },
    { id: 'pt-BR' as Locale, label: 'Português', flag: '🇧🇷' },
  ];

  activeSection = signal<Section>('ajustes');

  sections: { id: Section; labelKey: TranslationKey }[] = [
    { id: 'ajustes', labelKey: 'settings.ajustes' },
    { id: 'perfil', labelKey: 'settings.profile' },
    { id: 'apariencia', labelKey: 'settings.appearance' },
    { id: 'atajos', labelKey: 'settings.shortcuts' },
    { id: 'acerca', labelKey: 'settings.about' },
  ];

  private validSections: Section[] = ['ajustes', 'perfil', 'apariencia', 'atajos', 'acerca'];

  private resolveSection(raw: string | null): Section | null {
    if (!raw) return null;
    // Secciones idioma/monedas ahora viven dentro de perfil
    if (raw === 'idioma' || raw === 'monedas') return 'perfil';
    return this.validSections.includes(raw as Section) ? (raw as Section) : null;
  }

  ngOnInit() {
    const section = this.resolveSection(this.route.snapshot.queryParamMap.get('section'));
    if (section) this.activeSection.set(section);
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const s = this.resolveSection(params.get('section'));
      if (s) this.activeSection.set(s);
    });
  }

  selectLang(id: Locale) {
    this.i18n.setLocale(id);
  }

  selectCurrency(code: string) {
    this.auth.setBaseCurrency(code);
  }

  sectionLabel(s: { labelKey: TranslationKey }): string {
    return this.i18n.t(s.labelKey);
  }

  themeOptions: { id: Theme; name: string; bg: string; accent: string }[] = THEME_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    bg: p.isDark ? 'oklch(7% 0.004 30)' : 'oklch(98% 0.003 30)',
    accent: `oklch(${p.isDark ? 72 : 48}% 0.10 ${p.baseHue})`,
  }));

  newThemeName = '';
  newThemeAccent = '#7c5fb3';
  newThemeAccent2 = '#b68b4a';
  newThemeAccent3 = '#4fa083';
  newThemeBg = '#f8f8f6';
  newThemeIsDark = false;

  activeCustomName() {
    return localStorage.getItem('active-custom-theme') ?? '';
  }

  // Texto y líneas con contraste sobre el fondo elegido en el creador de temas
  creatorFg(): string {
    return this.isHexDark(this.newThemeBg) ? '#f4f4f2' : '#1d1b18';
  }

  creatorLine(): string {
    return this.isHexDark(this.newThemeBg) ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
  }

  // Superficie elevada derivada del fondo elegido (solo para la maqueta del borrador)
  creatorSurface(): string {
    const toward = this.isHexDark(this.newThemeBg) ? '#ffffff' : '#000000';
    return `color-mix(in srgb, ${this.newThemeBg} 93%, ${toward})`;
  }

  fontOptions = FONT_OPTIONS;

  // Paginación adaptativa: el tamaño de página se calcula según el ancho real
  // del contenedor (ResizeObserver). Si cabe todo, no hay pager.
  private presetListRef = viewChild<ElementRef<HTMLElement>>('presetListRef');
  private fontGridRef = viewChild<ElementRef<HTMLElement>>('fontGridRef');

  themePageSize = signal(24);
  fontPageSize = signal(13);
  themePage = signal(0);
  fontPage = signal(0);

  private readonly themeItemMin = 180 + 6; // minmax + gap de .preset-list
  private readonly themeMaxRows = 12;
  private readonly fontItemMin = 150 + 10; // minmax + gap de .font-grid
  private readonly fontRows = 2;

  constructor() {
    effect((onCleanup) => {
      const els = [this.presetListRef()?.nativeElement, this.fontGridRef()?.nativeElement].filter(
        (e): e is HTMLElement => !!e,
      );
      if (els.length === 0) return;
      const ro = new ResizeObserver(() => this.recalcPageSizes());
      els.forEach((e) => ro.observe(e));
      this.recalcPageSizes();
      onCleanup(() => ro.disconnect());
    });
  }

  private recalcPageSizes() {
    const themeEl = this.presetListRef()?.nativeElement;
    if (themeEl && themeEl.clientWidth > 0) {
      const cols = Math.max(1, Math.floor((themeEl.clientWidth + 6) / this.themeItemMin));
      const size = cols * this.themeMaxRows;
      if (size !== this.themePageSize()) {
        this.themePageSize.set(size);
        this.themePage.set(Math.min(this.themePage(), this.themePages() - 1));
      }
    }
    const fontEl = this.fontGridRef()?.nativeElement;
    if (fontEl && fontEl.clientWidth > 0) {
      const cols = Math.max(1, Math.floor((fontEl.clientWidth + 10) / this.fontItemMin));
      const size = cols * this.fontRows;
      if (size !== this.fontPageSize()) {
        this.fontPageSize.set(size);
        this.fontPage.set(Math.min(this.fontPage(), this.fontPages() - 1));
      }
    }
  }

  pagedThemes() {
    const start = this.themePage() * this.themePageSize();
    return this.themeOptions.slice(start, start + this.themePageSize());
  }

  themePages(): number {
    return Math.max(1, Math.ceil(this.themeOptions.length / this.themePageSize()));
  }

  pagedFonts() {
    const start = this.fontPage() * this.fontPageSize();
    return this.fontOptions.slice(start, start + this.fontPageSize());
  }

  fontPages(): number {
    return Math.max(1, Math.ceil(this.fontOptions.length / this.fontPageSize()));
  }

  private isHexDark(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
  }

  triadicFrom(hex: string, offset: number): string {
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
      accent2: this.newThemeAccent2,
      accent3: this.newThemeAccent3,
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

  shortcutCols = computed<ColumnDef<{ action: string; keys: string }>[]>(() => [
    { key: 'action', header: this.i18n.t('settings.accion'), sortable: true },
    { key: 'keys', header: this.i18n.t('settings.atajo'), width: '120px' },
  ]);

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
  public updates = inject(UpdateService);
  isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  public os = inject(PlatformService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  logout() {
    this.auth.logout();
  }
}
