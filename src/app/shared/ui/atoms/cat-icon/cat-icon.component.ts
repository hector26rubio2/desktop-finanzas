import { Component, input, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CAT_ICON_MAP } from '../../../cat-icons';

@Component({
  selector: 'app-cat-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<span [innerHTML]="svgHtml()"></span>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class CatIconComponent {
  private sanitizer = inject(DomSanitizer);

  icon = input<string>('');
  size = input(14);

  svgHtml = computed<SafeHtml>(() => {
    const id = this.icon();
    const s = this.size();
    const entry = CAT_ICON_MAP.get(id);
    if (!entry) return this.sanitizer.bypassSecurityTrustHtml('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${entry.path}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}
