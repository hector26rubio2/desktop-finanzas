import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import type { Locale } from '../i18n/locale.types';

interface LangOption {
  id: Locale;
  label: string;
  flag: string;
}

interface LangOptionExt extends LangOption {
  code: string;
}

const LANG_OPTIONS: LangOptionExt[] = [
  { id: 'es-CO', label: 'Español', flag: '🇨🇴', code: 'es-CO' },
  { id: 'en-US', label: 'English', flag: '🇺🇸', code: 'en-US' },
  { id: 'pt-BR', label: 'Português', flag: '🇧🇷', code: 'pt-BR' },
];

@Component({
  selector: 'app-lang-picker',
  standalone: true,
  styleUrl: './lang-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-btn-wrap" (mouseenter)="open()" (mouseleave)="close()">
      <button type="button" class="lang-btn" [class.active]="showPicker()" title="Idioma">
        {{ currentLang().flag }}
      </button>
      @if (showPicker()) {
        <div class="lang-popover" (mouseenter)="open()" (mouseleave)="close()">
          @for (opt of LANG_OPTIONS; track opt.id) {
            <button type="button" class="lang-option" [class.active]="currentLocale() === opt.id" (click)="select(opt)">
              <span class="lang-flag">{{ opt.flag }}</span>
              <span class="lang-option__txt">
                <span class="lang-option__name">{{ opt.label }}</span>
                <span class="lang-option__code">{{ opt.code }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class LangPickerComponent {
  currentLocale = input<Locale>('es-CO');
  localeChange = output<Locale>();

  readonly LANG_OPTIONS = LANG_OPTIONS;
  readonly showPicker = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly currentLang = computed(() => LANG_OPTIONS.find((l) => l.id === this.currentLocale()) ?? LANG_OPTIONS[0]);

  open() {
    if (this.timer) clearTimeout(this.timer);
    this.showPicker.set(true);
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.showPicker.set(false), 200);
  }

  select(opt: LangOption) {
    if (this.timer) clearTimeout(this.timer);
    this.localeChange.emit(opt.id);
    this.showPicker.set(false);
  }
}
