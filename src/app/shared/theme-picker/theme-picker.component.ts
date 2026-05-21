import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import type { Theme } from '../services/theme.service';

interface ThemeOption {
  id: Theme;
  name: string;
  accent: string;
  accent2: string;
  accent3: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidiana',
    accent: 'oklch(80% 0.12 78)',
    accent2: 'oklch(78% 0.1 198)',
    accent3: 'oklch(76% 0.1 318)',
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    accent: 'oklch(74% 0.16 245)',
    accent2: 'oklch(70% 0.14 5)',
    accent3: 'oklch(72% 0.14 125)',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    accent: 'oklch(74% 0.15 162)',
    accent2: 'oklch(72% 0.12 282)',
    accent3: 'oklch(74% 0.12 42)',
  },
  {
    id: 'claro',
    name: 'Claro',
    accent: 'oklch(48% 0.18 245)',
    accent2: 'oklch(42% 0.16 5)',
    accent3: 'oklch(44% 0.16 125)',
  },
  {
    id: 'institutional',
    name: 'Institución',
    accent: 'oklch(77.4% 0.052 228)',
    accent2: 'oklch(75% 0.04 348)',
    accent3: 'oklch(74% 0.06 108)',
  },
  {
    id: 'institutional-light',
    name: 'Inst. Claro',
    accent: 'oklch(22.7% 0.076 224)',
    accent2: 'oklch(20% 0.05 344)',
    accent3: 'oklch(24% 0.07 104)',
  },
  {
    id: 'espresso',
    name: 'Espresso',
    accent: 'oklch(77.6% 0.033 23)',
    accent2: 'oklch(74% 0.07 143)',
    accent3: 'oklch(72% 0.09 263)',
  },
  {
    id: 'espresso-light',
    name: 'Espresso Claro',
    accent: 'oklch(18.0% 0.021 24)',
    accent2: 'oklch(22% 0.06 144)',
    accent3: 'oklch(26% 0.08 264)',
  },
  {
    id: 'pulse',
    name: 'Pulso',
    accent: 'oklch(77.3% 0.048 261)',
    accent2: 'oklch(74% 0.08 21)',
    accent3: 'oklch(73% 0.09 141)',
  },
  {
    id: 'pulse-light',
    name: 'Pulso Claro',
    accent: 'oklch(22.0% 0.105 263)',
    accent2: 'oklch(20% 0.07 23)',
    accent3: 'oklch(25% 0.08 143)',
  },
];

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  styleUrl: './theme-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-btn-wrap" (mouseenter)="open()" (mouseleave)="close()">
      <button type="button" class="theme-top-btn" [class.active]="showPicker()" title="Cambiar tema">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path
            d="M12 2a7.53 7.53 0 0 0-7.5 7.5c0 2.07.83 3.93 2.18 5.29a4.5 4.5 0 0 1-.68 6.48A10.01 10.01 0 0 0 22 12 10 10 0 0 0 12 2z"
          />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
      @if (showPicker()) {
        <div class="theme-popover" (mouseenter)="open()" (mouseleave)="close()">
          @for (opt of THEME_OPTIONS; track opt.id) {
            <button type="button" class="theme-option" [class.active]="currentTheme() === opt.id" (click)="select(opt)">
              <span class="theme-swatch">
                <span class="theme-swatch__dot" [style.background]="opt.accent"></span>
                <span class="theme-swatch__dot" [style.background]="opt.accent2"></span>
                <span class="theme-swatch__dot" [style.background]="opt.accent3"></span>
              </span>
              <span class="theme-option__txt">
                <span class="theme-option__name">{{ formatLabel()(opt.id) }}</span>
                <span class="theme-option__desc">{{ formatLabel()(opt.id + '_desc') }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThemePickerComponent {
  currentTheme = input<Theme>('obsidian');
  formatLabel = input<(id: string) => string>((id: string) => id);
  themeChange = output<Theme>();

  readonly THEME_OPTIONS = THEME_OPTIONS;
  readonly showPicker = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  open() {
    if (this.timer) clearTimeout(this.timer);
    this.showPicker.set(true);
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.showPicker.set(false), 200);
  }

  select(opt: ThemeOption) {
    if (this.timer) clearTimeout(this.timer);
    this.themeChange.emit(opt.id);
    this.showPicker.set(false);
  }
}
