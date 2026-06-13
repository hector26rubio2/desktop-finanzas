import { Injectable, signal, computed } from '@angular/core';

export type Theme =
  | 'purple'
  | 'purple-light'
  | 'ocean'
  | 'ocean-light'
  | 'forest'
  | 'forest-light'
  | 'crimson'
  | 'crimson-light'
  | 'amber'
  | 'amber-light'
  | 'rose'
  | 'rose-light'
  | 'sky'
  | 'sky-light'
  | 'violet'
  | 'violet-light'
  | 'lime'
  | 'lime-light'
  | 'gold'
  | 'gold-light'
  | 'mint'
  | 'mint-light'
  | 'custom';

export type Density = 'dense' | 'comfy' | 'airy';
export type Shape = 'rounded' | 'sharp';

export type FontOption =
  | 'geist'
  | 'inter'
  | 'onest'
  | 'poppins'
  | 'nunito'
  | 'rubik'
  | 'manrope'
  | 'sora'
  | 'dm-sans'
  | 'work-sans'
  | 'system';

export interface FontPack {
  id: FontOption;
  name: string;
  family: string;
}

export const FONT_OPTIONS: FontPack[] = [
  { id: 'geist', name: 'Geist', family: "'Geist', system-ui, sans-serif" },
  { id: 'inter', name: 'Inter', family: "'Inter', system-ui, sans-serif" },
  { id: 'onest', name: 'Onest', family: "'Onest', system-ui, sans-serif" },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', system-ui, sans-serif" },
  { id: 'nunito', name: 'Nunito', family: "'Nunito', system-ui, sans-serif" },
  { id: 'rubik', name: 'Rubik', family: "'Rubik', system-ui, sans-serif" },
  { id: 'manrope', name: 'Manrope', family: "'Manrope', system-ui, sans-serif" },
  { id: 'sora', name: 'Sora', family: "'Sora', system-ui, sans-serif" },
  { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', system-ui, sans-serif" },
  { id: 'work-sans', name: 'Work Sans', family: "'Work Sans', system-ui, sans-serif" },
  { id: 'system', name: 'System', family: 'system-ui, -apple-system, sans-serif' },
];

export interface CustomTheme {
  name: string;
  isDark: boolean;
  accent: string;
  accent2: string;
  accent3: string;
  bg: string;
}

export interface ThemePreset {
  id: Theme;
  name: string;
  baseHue: number;
  isDark: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'purple', name: 'Púrpura', baseHue: 280, isDark: true },
  { id: 'purple-light', name: 'Púrpura Claro', baseHue: 280, isDark: false },
  { id: 'ocean', name: 'Océano', baseHue: 240, isDark: true },
  { id: 'ocean-light', name: 'Océano Claro', baseHue: 240, isDark: false },
  { id: 'forest', name: 'Bosque', baseHue: 160, isDark: true },
  { id: 'forest-light', name: 'Bosque Claro', baseHue: 160, isDark: false },
  { id: 'crimson', name: 'Carmesí', baseHue: 20, isDark: true },
  { id: 'crimson-light', name: 'Carmesí Claro', baseHue: 20, isDark: false },
  { id: 'amber', name: 'Ámbar', baseHue: 75, isDark: true },
  { id: 'amber-light', name: 'Ámbar Claro', baseHue: 75, isDark: false },
  { id: 'rose', name: 'Rosa', baseHue: 0, isDark: true },
  { id: 'rose-light', name: 'Rosa Claro', baseHue: 0, isDark: false },
  { id: 'sky', name: 'Cielo', baseHue: 210, isDark: true },
  { id: 'sky-light', name: 'Cielo Claro', baseHue: 210, isDark: false },
  { id: 'violet', name: 'Violeta', baseHue: 310, isDark: true },
  { id: 'violet-light', name: 'Violeta Claro', baseHue: 310, isDark: false },
  { id: 'lime', name: 'Lima', baseHue: 130, isDark: true },
  { id: 'lime-light', name: 'Lima Claro', baseHue: 130, isDark: false },
  { id: 'gold', name: 'Oro', baseHue: 95, isDark: true },
  { id: 'gold-light', name: 'Oro Claro', baseHue: 95, isDark: false },
  { id: 'mint', name: 'Menta', baseHue: 180, isDark: true },
  { id: 'mint-light', name: 'Menta Claro', baseHue: 180, isDark: false },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly validIds = new Set<string>(THEME_PRESETS.map((p) => p.id).concat('custom'));

  readonly theme = signal<Theme>(this.resolveStoredTheme());
  readonly density = signal<Density>((localStorage.getItem('density') as Density) ?? 'comfy');
  readonly shape = signal<Shape>((localStorage.getItem('shape') as Shape) ?? 'rounded');
  readonly font = signal<FontOption>(this.resolveStoredFont());
  readonly customThemes = signal<CustomTheme[]>(this.loadCustomThemes());

  readonly isDarkTheme = computed(() => {
    const t = this.theme();
    if (t !== 'custom') {
      const preset = THEME_PRESETS.find((p) => p.id === t);
      return preset ? preset.isDark : true;
    }
    const name = localStorage.getItem('active-custom-theme');
    const ct = this.customThemes().find((c) => c.name === name);
    return ct?.isDark ?? true;
  });

  readonly currentPreset = computed(() => THEME_PRESETS.find((p) => p.id === this.theme()));

  constructor() {
    this.applyAll();
    this.applyFont(this.font());
    const current = this.theme();
    if (current === 'custom') {
      this.applyCustomCssVars();
    } else {
      this.applyPreset(current);
    }
  }

  setTheme(t: Theme) {
    this.theme.set(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);

    if (t === 'custom') {
      this.applyCustomCssVars();
    } else {
      this.applyPreset(t);
    }
  }

  setDensity(d: Density) {
    this.density.set(d);
    localStorage.setItem('density', d);
    document.documentElement.setAttribute('data-density', d);
  }

  setShape(s: Shape) {
    this.shape.set(s);
    localStorage.setItem('shape', s);
    document.documentElement.setAttribute('data-shape', s);
  }

  setFont(f: FontOption) {
    this.font.set(f);
    localStorage.setItem('font', f);
    this.applyFont(f);
  }

  toggle() {
    this.setTheme(this.isDarkTheme() ? 'purple-light' : 'purple');
  }

  cycleTheme() {
    const ids = THEME_PRESETS.map((p) => p.id);
    const idx = ids.indexOf(this.theme() as Theme);
    this.setTheme(idx >= 0 ? ids[(idx + 1) % ids.length] : 'purple');
  }

  saveCustomTheme(ct: CustomTheme) {
    const list = this.customThemes();
    const existing = list.findIndex((t) => t.name === ct.name);
    const updated = existing >= 0 ? list.map((t, i) => (i === existing ? ct : t)) : [...list, ct];
    this.customThemes.set(updated);
    localStorage.setItem('custom-themes', JSON.stringify(updated));
    localStorage.setItem('active-custom-theme', ct.name);
    this.applyCustomCssVarsFrom(ct);
    this.setTheme('custom');
  }

  deleteCustomTheme(name: string) {
    const updated = this.customThemes().filter((t) => t.name !== name);
    this.customThemes.set(updated);
    localStorage.setItem('custom-themes', JSON.stringify(updated));
    if (this.theme() === 'custom') this.setTheme('purple');
  }

  activateCustomTheme(name: string) {
    const ct = this.customThemes().find((t) => t.name === name);
    if (!ct) return;
    localStorage.setItem('active-custom-theme', name);
    this.applyCustomCssVarsFrom(ct);
    this.setTheme('custom');
  }

  // ── Programmatic palette ──────────────────────────────────────────

  private applyPreset(id: string) {
    const preset = THEME_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.generateTriadicPalette(preset.baseHue, preset.isDark);
  }

  private applyCustomCssVarsFrom(ct: CustomTheme) {
    const accent = this.hexToOklch(ct.accent);
    const bg = this.hexToOklch(ct.bg);
    const root = document.documentElement;
    const h1 = Math.round(accent.h);
    const primaryChroma = clampChroma(accent.c);
    const secondHue = ct.accent2 ? Math.round(this.hexToOklch(ct.accent2).h) : (h1 + 120) % 360;
    const thirdHue = ct.accent3 ? Math.round(this.hexToOklch(ct.accent3).h) : (h1 + 240) % 360;
    const secChroma = clampChroma((ct.accent2 ? this.hexToOklch(ct.accent2).c : primaryChroma) * 0.9);
    const terChroma = clampChroma((ct.accent3 ? this.hexToOklch(ct.accent3).c : primaryChroma) * 0.8);
    const bgHue = Math.round(bg.h);
    const bgChroma = clampChroma(bg.c);

    this.generateTriadicPalette(h1, ct.isDark, primaryChroma, secChroma, terChroma, bgHue, secondHue, thirdHue);

    // Override bg scale with user's actual background chroma (not near-zero neutral)
    const isDark = ct.isDark;
    const bgL = bg.l * 100;
    const bgOff = isDark ? [0, 4, 9, 15] : [0, -3, -7, -12];
    const bgL0 = clampPct(bgL + bgOff[0]);
    const bgL1 = clampPct(bgL + bgOff[1]);
    const bgL2 = clampPct(bgL + bgOff[2]);
    const bgL3 = clampPct(bgL + bgOff[3]);
    root.style.setProperty('--color-page-bg', `oklch(${bgL0}% ${bgChroma} ${bgHue})`);
    root.style.setProperty('--color-surface', `oklch(${bgL1}% ${bgChroma} ${bgHue})`);
    root.style.setProperty('--color-surface-elevated', `oklch(${bgL2}% ${bgChroma} ${bgHue})`);
    root.style.setProperty('--color-surface-highest', `oklch(${bgL3}% ${bgChroma} ${bgHue})`);
    root.style.setProperty('--bg-0', `var(--color-page-bg)`);
    root.style.setProperty('--bg-1', `var(--color-surface)`);
    root.style.setProperty('--bg-2', `var(--color-surface-elevated)`);
    root.style.setProperty('--bg-3', `var(--color-surface-highest)`);
  }

  private generateTriadicPalette(
    primaryHue: number,
    isDark: boolean,
    primaryChroma = 0.1,
    secondaryChroma = 0.09,
    tertiaryChroma = 0.08,
    neutralHue = 30,
    secondaryHue?: number,
    tertiaryHue?: number,
  ) {
    const root = document.documentElement;
    const h1 = primaryHue;
    const h2 = secondaryHue ?? (primaryHue + 120) % 360;
    const h3 = tertiaryHue ?? (primaryHue + 240) % 360;
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    // Lightness curve: peak chroma at 500
    const L = [97, 92, 83, 72, 60, 48, 40, 31, 23, 15, 10];
    const cOff = [-0.04, -0.03, -0.02, -0.01, 0, 0, -0.01, -0.02, -0.03, -0.04, -0.05];

    // ── Accent scales ──
    const buildScale = (hue: number, baseC: number, prefix: string) => {
      for (let i = 0; i < 11; i++) {
        const c = clampChroma(baseC + cOff[i]);
        root.style.setProperty(`--color-${prefix}-${steps[i]}`, `oklch(${L[i]}% ${c} ${hue})`);
      }
    };
    buildScale(h1, primaryChroma, 'primary');
    buildScale(h2, secondaryChroma, 'secondary');
    buildScale(h3, tertiaryChroma, 'tertiary');

    // ── Neutral scale ──
    const nL = [98, 93, 85, 75, 63, 51, 39, 29, 19, 11, 7];
    const nC = [0.003, 0.004, 0.005, 0.005, 0.005, 0.006, 0.006, 0.006, 0.006, 0.005, 0.004];
    for (let i = 0; i < 11; i++) {
      root.style.setProperty(`--color-neutral-${steps[i]}`, `oklch(${nL[i]}% ${nC[i]} ${neutralHue})`);
    }

    // ── Semantic ──
    const sem = (name: string, lite: number, chroma: number, hue: number) => {
      const l = isDark ? Math.min(lite + 20, 80) : lite;
      root.style.setProperty(`--color-${name}`, `oklch(${l}% ${chroma} ${hue})`);
      const sl = isDark ? 15 : 92;
      const sc = isDark ? chroma * 0.35 : chroma * 0.4;
      root.style.setProperty(`--color-${name}-soft`, `oklch(${sl}% ${clampChroma(sc)} ${hue})`);
    };
    sem('success', 48, 0.12, 155);
    sem('warning', 56, 0.14, 80);
    sem('danger', 44, 0.16, 20);
    sem('info', 46, 0.14, 245);

    // ── Mode-dependent role tokens ──
    const accentStep = isDark ? 300 : 500;
    const accentStepDeep = isDark ? 500 : 600;

    root.style.setProperty('--color-primary', `var(--color-primary-${accentStep})`);
    root.style.setProperty('--color-secondary', `var(--color-secondary-${accentStep})`);
    root.style.setProperty('--color-tertiary', `var(--color-tertiary-${accentStep})`);

    root.style.setProperty('--color-page-bg', isDark ? 'var(--color-neutral-950)' : 'var(--color-neutral-50)');
    root.style.setProperty('--color-surface', isDark ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)');
    root.style.setProperty(
      '--color-surface-elevated',
      isDark ? 'var(--color-neutral-800)' : 'var(--color-neutral-200)',
    );
    root.style.setProperty('--color-surface-highest', isDark ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)');

    root.style.setProperty('--color-text-body', isDark ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)');
    root.style.setProperty('--color-text-muted', isDark ? 'var(--color-neutral-400)' : 'var(--color-neutral-600)');
    root.style.setProperty('--color-text-subtle', isDark ? 'var(--color-neutral-500)' : 'var(--color-neutral-400)');

    root.style.setProperty('--color-border-subtle', isDark ? 'var(--color-neutral-800)' : 'var(--color-neutral-200)');
    root.style.setProperty('--color-border-default', isDark ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)');
    root.style.setProperty('--color-border-strong', isDark ? 'var(--color-neutral-500)' : 'var(--color-neutral-400)');

    const fgAccent = isDark ? 'var(--color-neutral-950)' : 'var(--color-neutral-50)';
    root.style.setProperty('--color-text-on-primary', fgAccent);
    root.style.setProperty('--color-text-on-secondary', fgAccent);
    root.style.setProperty('--color-text-on-tertiary', fgAccent);
    root.style.setProperty('--color-text-on-success', fgAccent);
    root.style.setProperty('--color-text-on-danger', fgAccent);
    root.style.setProperty('--color-text-on-info', fgAccent);
    root.style.setProperty('--color-text-on-warning', isDark ? 'var(--color-neutral-950)' : 'var(--color-neutral-950)');

    // ── Interaction ──
    root.style.setProperty(
      '--color-hover',
      isDark
        ? 'color-mix(in srgb, var(--color-neutral-50) 4%, transparent)'
        : 'color-mix(in srgb, var(--color-neutral-900) 4%, transparent)',
    );
    root.style.setProperty(
      '--color-selected',
      isDark
        ? `color-mix(in srgb, var(--color-primary-300) 14%, transparent)`
        : `color-mix(in srgb, var(--color-primary-500) 12%, transparent)`,
    );

    root.style.setProperty(
      '--color-shadow-1',
      isDark
        ? '0 1px 0 color-mix(in srgb, var(--color-neutral-50) 6%, transparent) inset, 0 1px 2px color-mix(in srgb, var(--color-neutral-950) 30%, transparent)'
        : '0 1px 0 color-mix(in srgb, var(--color-neutral-50) 70%, transparent) inset, 0 1px 3px color-mix(in srgb, var(--color-neutral-900) 12%, transparent)',
    );
    root.style.setProperty(
      '--color-shadow-2',
      isDark
        ? '0 10px 30px color-mix(in srgb, var(--color-neutral-950) 45%, transparent)'
        : '0 10px 30px color-mix(in srgb, var(--color-neutral-900) 14%, transparent)',
    );

    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light');

    // ── Backward-compat aliases ──
    root.style.setProperty('--bg-0', 'var(--color-page-bg)');
    root.style.setProperty('--bg-1', 'var(--color-surface)');
    root.style.setProperty('--bg-2', 'var(--color-surface-elevated)');
    root.style.setProperty('--bg-3', 'var(--color-surface-highest)');
    root.style.setProperty('--fg-0', 'var(--color-text-body)');
    root.style.setProperty('--fg-1', 'var(--color-text-muted)');
    root.style.setProperty('--fg-2', 'var(--color-text-subtle)');
    root.style.setProperty('--fg-3', isDark ? 'var(--color-neutral-500)' : 'var(--color-neutral-400)');
    root.style.setProperty('--fg-4', isDark ? 'var(--color-neutral-600)' : 'var(--color-neutral-300)');
    root.style.setProperty('--accent', 'var(--color-primary)');
    root.style.setProperty(
      '--accent-soft',
      isDark
        ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
        : 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
    );
    root.style.setProperty('--accent-deep', `var(--color-primary-${accentStepDeep})`);
    root.style.setProperty('--accent-fg', 'var(--color-text-on-primary)');
    root.style.setProperty('--accent-2', 'var(--color-secondary)');
    root.style.setProperty(
      '--accent-2-soft',
      isDark
        ? 'color-mix(in srgb, var(--color-secondary) 18%, transparent)'
        : 'color-mix(in srgb, var(--color-secondary) 14%, transparent)',
    );
    root.style.setProperty('--accent-3', 'var(--color-tertiary)');
    root.style.setProperty(
      '--accent-3-soft',
      isDark
        ? 'color-mix(in srgb, var(--color-tertiary) 18%, transparent)'
        : 'color-mix(in srgb, var(--color-tertiary) 14%, transparent)',
    );
    root.style.setProperty('--line', 'var(--color-border-subtle)');
    root.style.setProperty('--line-1', 'var(--color-border-default)');
    root.style.setProperty('--line-2', 'var(--color-border-strong)');
    root.style.setProperty('--hover', 'var(--color-hover)');
    root.style.setProperty('--selected', 'var(--color-selected)');
    root.style.setProperty('--positive', 'var(--color-success)');
    root.style.setProperty('--positive-soft', 'var(--color-success-soft)');
    root.style.setProperty('--negative', 'var(--color-danger)');
    root.style.setProperty('--negative-soft', 'var(--color-danger-soft)');
    root.style.setProperty('--warning', 'var(--color-warning)');
    root.style.setProperty('--warning-soft', 'var(--color-warning-soft)');
    root.style.setProperty('--info', 'var(--color-info)');
    root.style.setProperty('--info-soft', 'var(--color-info-soft)');
    root.style.setProperty('--shadow-1', 'var(--color-shadow-1)');
    root.style.setProperty('--shadow-2', 'var(--color-shadow-2)');
  }

  // ── Font ─────────────────────────────────────────────────────────

  private applyFont(f: FontOption) {
    const opt = FONT_OPTIONS.find((o) => o.id === f);
    if (opt) {
      document.documentElement.style.setProperty('--font-family', opt.family);
    }
  }

  private resolveStoredFont(): FontOption {
    const raw = localStorage.getItem('font');
    if (raw && FONT_OPTIONS.some((o) => o.id === raw)) return raw as FontOption;
    return 'geist';
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private resolveStoredTheme(): Theme {
    const raw = localStorage.getItem('theme');
    if (raw && this.validIds.has(raw)) return raw as Theme;
    if (raw) localStorage.setItem('theme', 'purple');
    return 'purple';
  }

  private applyCustomCssVars() {
    const name = localStorage.getItem('active-custom-theme');
    const ct = this.customThemes().find((t) => t.name === name);
    if (ct) this.applyCustomCssVarsFrom(ct);
  }

  private loadCustomThemes(): CustomTheme[] {
    try {
      return JSON.parse(localStorage.getItem('custom-themes') ?? '[]');
    } catch {
      return [];
    }
  }

  private hexToOklch(hex: string): { l: number; c: number; h: number } {
    const r1 = parseInt(hex.slice(1, 3), 16) / 255;
    const g1 = parseInt(hex.slice(3, 5), 16) / 255;
    const b1 = parseInt(hex.slice(5, 7), 16) / 255;

    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const r = srgbToLinear(r1);
    const g = srgbToLinear(g1);
    const b = srgbToLinear(b1);

    const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l3 = Math.cbrt(l_);
    const m3 = Math.cbrt(m_);
    const s3 = Math.cbrt(s_);

    const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
    const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
    const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;

    const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
    const chroma = Math.sqrt(a * a + bb * bb);

    const maxC = Math.max(r1, g1, b1);
    const minC = Math.min(r1, g1, b1);
    const naiveChroma = (maxC - minC) * 0.18;

    return {
      l: L,
      c: chroma > 0.01 ? chroma : naiveChroma,
      h: hue,
    };
  }

  private applyAll() {
    document.documentElement.setAttribute('data-theme', this.theme());
    document.documentElement.setAttribute('data-density', this.density());
    document.documentElement.setAttribute('data-shape', this.shape());
    this.applyFont(this.font());
  }
}

function clampChroma(c: number): number {
  return Math.round(Math.max(0.003, Math.min(0.5, c)) * 1000) / 1000;
}

function clampPct(v: number): number {
  return Math.round(Math.max(3, Math.min(98, v)) * 10) / 10;
}
