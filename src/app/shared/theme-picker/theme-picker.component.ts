import { Component, input, output, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import type { Theme } from '../services/theme.service';
import { THEME_PRESETS } from '../services/theme.service';
import { I18nService } from '../i18n/i18n.service';

interface ThemeOption {
  id: Theme;
  accent: string;
  accent2: string;
  accent3: string;
}

function buildOptions(): ThemeOption[] {
  return THEME_PRESETS.map((p) => ({
    id: p.id,
    accent: `oklch(${p.isDark ? 72 : 48}% 0.10 ${p.baseHue})`,
    accent2: `oklch(${p.isDark ? 70 : 47}% 0.09 ${(p.baseHue + 120) % 360})`,
    accent3: `oklch(${p.isDark ? 70 : 46}% 0.08 ${(p.baseHue + 240) % 360})`,
  }));
}

const THEME_OPTIONS: ThemeOption[] = buildOptions();

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  styleUrl: './theme-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-btn-wrap" (mouseenter)="open()" (mouseleave)="close()">
      <button
        type="button"
        class="theme-top-btn"
        [class.active]="showPicker()"
        [attr.title]="i18n.t('common.change_theme')"
      >
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
                <span class="theme-option__name">{{ i18n.t('theme.' + opt.id) }}</span>
                <span class="theme-option__desc">{{ formatLabel()(opt.id) }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThemePickerComponent {
  readonly i18n = inject(I18nService);
  currentTheme = input<Theme>('purple');
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
