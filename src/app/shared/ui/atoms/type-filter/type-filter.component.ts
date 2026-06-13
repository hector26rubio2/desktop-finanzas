import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-type-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="type-filter">
      @for (opt of options(); track opt.value) {
        <button
          class="type-filter__btn"
          [class.type-filter__btn--active]="active() === opt.value"
          (click)="activeChange.emit(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .type-filter {
        display: flex;
        gap: 2px;
        padding: 2px;
        background: var(--bg-2);
        border-radius: 6px;
      }
      .type-filter__btn {
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--fg-2);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        transition:
          background 0.1s,
          color 0.1s;
      }
      .type-filter__btn:hover {
        color: var(--fg-0);
      }
      .type-filter__btn--active {
        background: var(--bg-0);
        color: var(--fg-0);
        font-weight: 500;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeFilterComponent {
  options = input.required<FilterOption[]>();
  active = input.required<string>();
  activeChange = output<string>();
}
