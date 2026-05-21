import { Injectable, signal, computed } from '@angular/core';

export type Theme =
  | 'obsidian'
  | 'midnight'
  | 'emerald'
  | 'claro'
  | 'institutional'
  | 'institutional-light'
  | 'espresso'
  | 'espresso-light'
  | 'pulse'
  | 'pulse-light'
  | 'custom';
export type Density = 'dense' | 'comfy' | 'airy';
export type Shape = 'rounded' | 'sharp';

export interface CustomTheme {
  name: string;
  isDark: boolean;
  accent: string; // hex color for --accent
  accent2: string; // hex color for --accent-2 (triadic +120°)
  accent3: string; // hex color for --accent-3 (triadic +240°)
  bg: string; // hex color for bg-0
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>((localStorage.getItem('theme') as Theme) ?? 'midnight');
  readonly density = signal<Density>((localStorage.getItem('density') as Density) ?? 'comfy');
  readonly shape = signal<Shape>((localStorage.getItem('shape') as Shape) ?? 'rounded');
  readonly customThemes = signal<CustomTheme[]>(this.loadCustomThemes());

  private readonly darkBuiltins: Record<string, boolean> = {
    obsidian: true,
    midnight: true,
    emerald: true,
    institutional: true,
    espresso: true,
    pulse: true,
    claro: false,
    'institutional-light': false,
    'espresso-light': false,
    'pulse-light': false,
  };

  readonly isDarkTheme = computed(() => {
    const t = this.theme();
    if (t !== 'custom') return this.darkBuiltins[t] ?? true;
    const name = localStorage.getItem('active-custom-theme');
    const ct = this.customThemes().find((c) => c.name === name);
    return ct?.isDark ?? true;
  });

  constructor() {
    this.applyAll();
    if (this.theme() === 'custom') this.applyCustomCssVars();
  }

  setTheme(t: Theme) {
    this.theme.set(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'custom') this.applyCustomCssVars();
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

  toggle() {
    this.setTheme(this.isDarkTheme() ? 'claro' : 'midnight');
  }

  cycleTheme() {
    const themes: Theme[] = [
      'obsidian',
      'midnight',
      'emerald',
      'institutional',
      'espresso',
      'pulse',
      'claro',
      'institutional-light',
      'espresso-light',
      'pulse-light',
    ];
    const idx = themes.indexOf(this.theme() as Theme);
    this.setTheme(themes[(idx + 1) % themes.length]);
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
    if (this.theme() === 'custom') this.setTheme('midnight');
  }

  activateCustomTheme(name: string) {
    const ct = this.customThemes().find((t) => t.name === name);
    if (!ct) return;
    localStorage.setItem('active-custom-theme', name);
    this.applyCustomCssVarsFrom(ct);
    this.setTheme('custom');
  }

  private loadCustomThemes(): CustomTheme[] {
    try {
      return JSON.parse(localStorage.getItem('custom-themes') ?? '[]');
    } catch {
      return [];
    }
  }

  private applyCustomCssVars() {
    const name = localStorage.getItem('active-custom-theme');
    const ct = this.customThemes().find((t) => t.name === name);
    if (ct) this.applyCustomCssVarsFrom(ct);
  }

  private applyCustomCssVarsFrom(ct: CustomTheme) {
    const root = document.documentElement;
    const accent = this.hexToOklch(ct.accent);
    const bg = this.hexToOklch(ct.bg);
    const isDark = ct.isDark;

    // Derive bg scale from base bg
    const bgL = isDark ? [bg.l, bg.l + 0.03, bg.l + 0.07, bg.l + 0.12] : [bg.l, bg.l - 0.03, bg.l - 0.07, bg.l - 0.12];
    const fgBase = isDark ? 0.96 : 0.14;

    root.style.setProperty('--custom-bg-0', `oklch(${(bgL[0] * 100).toFixed(1)}% ${bg.c} ${bg.h})`);
    root.style.setProperty('--custom-bg-1', `oklch(${(bgL[1] * 100).toFixed(1)}% ${bg.c} ${bg.h})`);
    root.style.setProperty('--custom-bg-2', `oklch(${(bgL[2] * 100).toFixed(1)}% ${bg.c} ${bg.h})`);
    root.style.setProperty('--custom-bg-3', `oklch(${(bgL[3] * 100).toFixed(1)}% ${bg.c} ${bg.h})`);
    root.style.setProperty('--custom-fg-0', `oklch(${(fgBase * 100).toFixed(0)}% 0.010 ${bg.h})`);
    root.style.setProperty('--custom-fg-1', `oklch(${isDark ? 78 : 30}% 0.012 ${bg.h})`);
    root.style.setProperty('--custom-fg-2', `oklch(${isDark ? 58 : 48}% 0.010 ${bg.h})`);
    root.style.setProperty('--custom-fg-3', `oklch(${isDark ? 40 : 62}% 0.008 ${bg.h})`);
    root.style.setProperty('--custom-fg-4', `oklch(${isDark ? 28 : 74}% 0.006 ${bg.h})`);
    root.style.setProperty('--custom-line', `oklch(${isDark ? '100% 0 0 / 0.07' : '0% 0 0 / 0.09'})`);
    root.style.setProperty('--custom-line-1', `oklch(${isDark ? '100% 0 0 / 0.10' : '0% 0 0 / 0.13'})`);
    root.style.setProperty('--custom-line-2', `oklch(${isDark ? '100% 0 0 / 0.16' : '0% 0 0 / 0.20'})`);
    root.style.setProperty(
      '--custom-accent',
      `oklch(${isDark ? Math.min(accent.l + 0.3, 0.8) : Math.min(accent.l, 0.52)} ${accent.c} ${accent.h})`,
    );
    root.style.setProperty(
      '--custom-accent-soft',
      `oklch(${isDark ? Math.min(accent.l + 0.3, 0.8) : Math.min(accent.l, 0.52)} ${accent.c} ${accent.h} / ${isDark ? '0.16' : '0.12'})`,
    );
    root.style.setProperty(
      '--custom-accent-deep',
      `oklch(${isDark ? accent.l * 100 : Math.min(accent.l * 0.75, 0.38) * 100}% ${accent.c} ${accent.h})`,
    );
    root.style.setProperty('--custom-accent-fg', `oklch(${isDark ? '15% 0.01 70' : '99% 0.005 245'})`);

    // Triadic accent-2 (+120°) and accent-3 (+240°)
    const h2 = ((+accent.h + 120) % 360).toFixed(0);
    const h3 = ((+accent.h + 240) % 360).toFixed(0);
    const a2 = ct.accent2 ? this.hexToOklch(ct.accent2) : { l: accent.l, c: accent.c, h: h2 };
    const a3 = ct.accent3 ? this.hexToOklch(ct.accent3) : { l: accent.l, c: accent.c, h: h3 };
    const a2L = isDark ? Math.min(a2.l + 0.3, 0.8) : Math.min(a2.l, 0.52);
    const a3L = isDark ? Math.min(a3.l + 0.3, 0.8) : Math.min(a3.l, 0.52);
    root.style.setProperty('--custom-accent-2', `oklch(${a2L} ${a2.c} ${a2.h})`);
    root.style.setProperty('--custom-accent-3', `oklch(${a3L} ${a3.c} ${a3.h})`);
    root.style.setProperty('--custom-color-scheme', isDark ? 'dark' : 'light');
  }

  private hexToOklch(hex: string): { l: number; c: string; h: string } {
    const r1 = parseInt(hex.slice(1, 3), 16) / 255;
    const g1 = parseInt(hex.slice(3, 5), 16) / 255;
    const b1 = parseInt(hex.slice(5, 7), 16) / 255;

    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

    const r = srgbToLinear(r1);
    const g = srgbToLinear(g1);
    const b = srgbToLinear(b1);

    // sRGB → OKLab (Bottos 2021)
    const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l3 = Math.cbrt(l_);
    const m3 = Math.cbrt(m_);
    const s3 = Math.cbrt(s_);

    const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
    const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
    const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;

    const hue = (Math.atan2(bb, a) * 180) / Math.PI;
    const chroma = Math.sqrt(a * a + bb * bb);

    const maxC = Math.max(r1, g1, b1);
    const minC = Math.min(r1, g1, b1);
    const naiveChroma = ((maxC - minC) * 0.18).toFixed(3);

    return {
      l: L,
      c: chroma > 0.01 ? chroma.toFixed(3) : naiveChroma,
      h: ((hue + 360) % 360).toFixed(0),
    };
  }

  private applyAll() {
    document.documentElement.setAttribute('data-theme', this.theme());
    document.documentElement.setAttribute('data-density', this.density());
    document.documentElement.setAttribute('data-shape', this.shape());
  }
}
