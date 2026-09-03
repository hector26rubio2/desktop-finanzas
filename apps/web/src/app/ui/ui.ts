import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';

export interface TableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'demo-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="viewport"
      data-testid="table-scroll"
      tabindex="0"
      aria-label="Tabla de registros, desplazamiento interno"
    >
      <table>
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col">{{ column.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of visibleRows(); track $index) {
            <tr (click)="rowSelected.emit(row)">
              @for (column of columns(); track column.key; let first = $first) {
                <td>
                  @if (first) {
                    <button
                      type="button"
                      class="row-link"
                      (click)="$event.stopPropagation(); rowSelected.emit(row)"
                      [attr.aria-label]="'Ver detalle: ' + display(row[column.key])"
                    >
                      {{ display(row[column.key]) }}
                    </button>
                  } @else {
                    {{ display(row[column.key]) }}
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="columns().length || 1" class="empty">No hay registros para estos filtros.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <footer>
      <span aria-live="polite">{{ start() }}–{{ end() }} de {{ rows().length }}</span>
      <label
        >Filas
        <select aria-label="Filas por página" [value]="size()" (change)="setSize($event)">
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
        </select></label
      >
      <div class="pages">
        <button
          type="button"
          aria-label="Página anterior"
          [disabled]="currentPage() === 0"
          (click)="page.set(currentPage() - 1)"
        >
          ←</button
        ><span>{{ currentPage() + 1 }} / {{ pageCount() }}</span
        ><button
          type="button"
          aria-label="Página siguiente"
          [disabled]="currentPage() + 1 >= pageCount()"
          (click)="page.set(currentPage() + 1)"
        >
          →
        </button>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        flex: 1;
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
        background: var(--surface);
        color: var(--text);
      }
      .viewport {
        min-height: 0;
        flex: 1;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--line) transparent;
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        text-align: left;
        font-size: 0.875rem;
      }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--surface);
        color: var(--muted);
        font-weight: 600;
        font-size: 0.75rem;
        letter-spacing: 0.02em;
      }
      th,
      td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--line);
        white-space: nowrap;
      }
      tbody tr {
        cursor: pointer;
      }
      tbody tr:hover,
      tbody tr:focus-within {
        background: color-mix(in srgb, var(--accent) 7%, var(--surface));
      }
      .row-link {
        border: 0;
        background: none;
        color: var(--text);
        font: inherit;
        text-align: left;
        padding: 0;
        cursor: pointer;
        font-weight: 600;
      }
      .empty {
        text-align: center;
        padding: 48px 16px;
        color: var(--muted);
        white-space: normal;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 18px;
        justify-content: space-between;
        flex-wrap: wrap;
        padding: 12px 16px;
        font-size: 0.75rem;
        color: var(--muted);
        border-top: 1px solid var(--line);
        flex-shrink: 0;
      }
      label,
      .pages {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      select,
      .pages button {
        font: inherit;
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 7px;
        min-height: 32px;
        padding: 4px 9px;
      }
      .pages button:disabled {
        opacity: 0.35;
        cursor: default;
      }
      button:focus-visible,
      select:focus-visible,
      .viewport:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      @media (max-width: 520px) {
        th,
        td {
          padding: 12px;
        }
        footer {
          gap: 10px;
        }
      }
    `,
  ],
})
export class DataTableComponent {
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<Record<string, any>[]>([]);
  readonly pageSize = input(10);
  @Output() readonly rowSelected = new EventEmitter<Record<string, any>>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();
  readonly page = signal(0);
  private readonly selectedSize = signal<number | null>(null);
  readonly size = computed(() => Math.max(1, this.selectedSize() ?? this.pageSize()));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / this.size())));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly start = computed(() => (this.rows().length ? this.currentPage() * this.size() + 1 : 0));
  readonly end = computed(() => Math.min((this.currentPage() + 1) * this.size(), this.rows().length));
  readonly visibleRows = computed(() => this.rows().slice(this.currentPage() * this.size(), this.end()));
  setSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
  }
  display(value: unknown): string {
    return value == null ? '—' : String(value);
  }
}

@Component({
  selector: 'demo-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [class.inspector]="mode() === 'inspector'"
      [attr.aria-label]="title()"
      (cancel)="onCancel($event)"
      (click)="backdrop($event)"
    >
      <section class="panel">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" aria-label="Cerrar panel" (click)="requestClose()">✕</button>
        </header>
        <div class="content"><ng-content /></div>
      </section>
    </dialog>
  `,
  styles: [
    `
      dialog {
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 20px;
        width: min(760px, calc(100vw - 32px));
        max-width: none;
        max-height: calc(100dvh - 32px);
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 24px 80px #0004;
      }
      dialog::backdrop {
        background: #07191480;
        backdrop-filter: blur(3px);
      }
      dialog.inspector {
        margin: 0 0 0 auto;
        width: min(540px, 100vw);
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 18px 0 0 18px;
        border-width: 0 0 0 1px;
      }
      .panel {
        display: flex;
        flex-direction: column;
        max-height: calc(100dvh - 34px);
      }
      .inspector .panel {
        height: 100%;
        max-height: 100%;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 22px 24px;
        border-bottom: 1px solid var(--line);
        flex-shrink: 0;
      }
      h2 {
        font-size: 1.15rem;
        margin: 0;
        font-weight: 650;
      }
      header button {
        width: 36px;
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
      }
      .content {
        padding: 24px;
        overflow: auto;
        min-height: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--line) transparent;
      }
      button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 3px;
      }
      @media (max-width: 540px) {
        dialog {
          width: calc(100vw - 16px);
          max-height: calc(100dvh - 16px);
        }
        dialog.inspector {
          border-radius: 0;
        }
        .content {
          padding: 18px;
        }
        header {
          padding: 18px;
        }
      }
    `,
  ],
})
export class OverlayComponent implements AfterViewInit, OnDestroy {
  readonly title = input('Detalle');
  readonly mode = input<'modal' | 'inspector'>('inspector');
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  private previousFocus: HTMLElement | null = null;
  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy(): void {
    this.dialog.nativeElement.close();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }
  requestClose(): void {
    this.dialog.nativeElement.close();
    this.closed.emit();
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }
  backdrop(event: MouseEvent): void {
    if (event.target !== this.dialog.nativeElement) return;
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.requestClose();
  }
}

@Component({
  selector: 'demo-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="label">{{ label() }}</span
    ><strong>{{ value() }}</strong>
    @if (hint()) {
      <span class="hint">{{ hint() }}</span>
    }`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 9px;
        min-width: 0;
        padding: 20px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        color: var(--text);
      }
      .label {
        font-size: 0.78rem;
        color: var(--muted);
      }
      strong {
        font-size: clamp(1.25rem, 2vw, 1.8rem);
        font-weight: 650;
        letter-spacing: -0.04em;
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
      }
      .hint {
        font-size: 0.72rem;
        color: var(--muted);
      }
    `,
  ],
})
export class KpiComponent {
  readonly label = input('');
  readonly value = input('');
  readonly hint = input('');
}

@Component({
  selector: 'demo-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div aria-hidden="true" class="symbol">◇</div>
    <h3>{{ title() }}</h3>
    <p>{{ detail() }}</p>
    <ng-content />`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 180px;
        padding: 24px;
        text-align: center;
        color: var(--text);
      }
      .symbol {
        color: var(--accent);
        font-size: 2rem;
      }
      h3 {
        font-size: 1rem;
        margin: 12px 0 8px;
      }
      p {
        color: var(--muted);
        font-size: 0.875rem;
        max-width: 420px;
        line-height: 1.6;
        margin: 0 0 16px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly title = input('Todavía no hay registros');
  readonly detail = input('Agrega un movimiento para comenzar.');
}

@Component({
  selector: 'demo-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span role="status" class="sr-only">Cargando contenido…</span>
    <div class="line short"></div>
    <div class="line"></div>
    <div class="line"></div>
    <div class="line"></div>`,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        border-radius: 14px;
        background: var(--surface);
      }
      .line {
        height: 32px;
        margin-bottom: 16px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--muted) 15%, var(--surface));
        animation: pulse 1.4s ease-in-out infinite;
      }
      .short {
        width: 40%;
        height: 20px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      @keyframes pulse {
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .line {
          animation: none;
        }
      }
    `,
  ],
})
export class SkeletonComponent {}
