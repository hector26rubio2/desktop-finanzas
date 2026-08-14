import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="search-input">
      <svg
        class="search-input__icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="M12 12l3 3" />
      </svg>
      <input
        class="search-input__field"
        type="text"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [ngModel]="query()"
        (ngModelChange)="onInput($event)"
      />
    </div>
  `,
  styles: [
    `
      .search-input {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--bg-1);
        transition: border-color 0.12s;
      }
      .search-input:focus-within {
        border-color: var(--accent);
      }
      .search-input__icon {
        width: 13px;
        height: 13px;
        flex-shrink: 0;
        color: var(--fg-3);
      }
      .search-input__field {
        border: none;
        background: transparent;
        color: var(--fg-0);
        font: inherit;
        font-size: 12px;
        width: 140px;
        outline: none;
      }
      .search-input__field::placeholder {
        color: var(--fg-3);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInputComponent {
  placeholder = input('Buscar…');
  delay = input(200);
  query = input('');

  queryChange = output<string>();

  private timer?: ReturnType<typeof setTimeout>;

  onInput(value: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.queryChange.emit(value), this.delay());
  }
}
