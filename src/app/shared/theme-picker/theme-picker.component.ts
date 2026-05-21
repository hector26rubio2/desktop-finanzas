import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import type { Theme } from '../services/theme.service';

interface ThemeOption {
  id: Theme;
  name: string;
  accent: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'obsidian', name: 'Obsidiana', accent: 'oklch(80% 0.12 78)' },
  { id: 'midnight', name: 'Medianoche', accent: 'oklch(74% 0.16 245)' },
  { id: 'emerald', name: 'Esmeralda', accent: 'oklch(74% 0.15 162)' },
  { id: 'claro', name: 'Claro', accent: 'oklch(48% 0.18 245)' },
  { id: 'institutional', name: 'Institución', accent: 'oklch(77.4% 0.052 228)' },
  { id: 'institutional-light', name: 'Inst. Claro', accent: 'oklch(22.7% 0.076 224)' },
  { id: 'espresso', name: 'Espresso', accent: 'oklch(77.6% 0.033 23)' },
  { id: 'espresso-light', name: 'Espresso Claro', accent: 'oklch(18.0% 0.021 24)' },
  { id: 'pulse', name: 'Pulso', accent: 'oklch(77.3% 0.048 261)' },
  { id: 'pulse-light', name: 'Pulso Claro', accent: 'oklch(22.0% 0.105 263)' },
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
              <span class="theme-swatch" [style.background]="opt.accent"></span>
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
