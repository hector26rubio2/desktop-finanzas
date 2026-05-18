import { Injectable, signal, computed } from '@angular/core';

export type Theme = 'obsidian' | 'midnight' | 'emerald' | 'claro' | 'custom';
export type Density = 'dense' | 'comfy' | 'airy';
export type Shape = 'rounded' | 'sharp';

export interface CustomTheme {
  name: string;
  isDark: boolean;
  accent: string; // hex color
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
    claro: false,
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
    const themes: Theme[] = ['obsidian', 'midnight', 'emerald', 'claro'];
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
    root.style.setProperty('--custom-color-scheme', isDark ? 'dark' : 'light');
  }

  private hexToOklch(hex: string): { l: number; c: string; h: string } {
    // Simple approximation: convert hex → rough oklch for theming
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const maxC = Math.max(r, g, b),
      minC = Math.min(r, g, b);
    const chroma = ((maxC - minC) * 0.18).toFixed(3);
    let hue = 0;
    if (maxC !== minC) {
      if (maxC === r) hue = ((g - b) / (maxC - minC)) * 60;
      else if (maxC === g) hue = (2 + (b - r) / (maxC - minC)) * 60;
      else hue = (4 + (r - g) / (maxC - minC)) * 60;
      if (hue < 0) hue += 360;
    }
    return { l, c: chroma, h: hue.toFixed(0) };
  }

  private applyAll() {
    document.documentElement.setAttribute('data-theme', this.theme());
    document.documentElement.setAttribute('data-density', this.density());
    document.documentElement.setAttribute('data-shape', this.shape());
  }
}
