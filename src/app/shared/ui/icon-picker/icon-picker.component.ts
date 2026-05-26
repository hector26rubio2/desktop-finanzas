import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CAT_ICONS } from '../../cat-icons';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
      }
      .icon-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 3px;
        max-height: 160px;
        overflow-y: auto;
        padding: 4px;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        background: var(--bg-1);
        margin-top: 4px;
      }
      .icon-item {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fg-2);
        cursor: pointer;
        transition:
          background 0.1s,
          border-color 0.1s,
          color 0.1s;
      }
      .icon-item:hover {
        background: var(--hover);
        color: var(--fg-0);
      }
      .icon-item--active {
        background: color-mix(in oklab, var(--accent) 15%, var(--bg-1));
        border-color: var(--accent);
        color: var(--accent);
      }
    `,
  ],
  template: `
    <div class="icon-grid">
      @for (icon of icons; track icon.id) {
        <button
          class="icon-item"
          [class.icon-item--active]="selectedIcon() === icon.id"
          (click)="selectIcon(icon.id)"
          [title]="icon.label"
          type="button"
        >
          <span [innerHTML]="iconSvgs()[icon.id]"></span>
        </button>
      }
    </div>
  `,
})
export class IconPickerComponent {
  private sanitizer = inject(DomSanitizer);

  selectedIcon = input<string>('');
  iconChange = output<string>();

  icons = CAT_ICONS;

  iconSvgs = () => {
    const map: Record<string, SafeHtml> = {};
    for (const icon of CAT_ICONS) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.path}</svg>`;
      map[icon.id] = this.sanitizer.bypassSecurityTrustHtml(svg);
    }
    return map;
  };

  selectIcon(id: string) {
    this.iconChange.emit(id);
  }
}
