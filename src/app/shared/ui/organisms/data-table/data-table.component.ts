import { Component, input, output, signal, computed, ChangeDetectionStrategy, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../../molecules/pagination/pagination.component';

export interface ColumnDef<T> {
  key: keyof T & string;
  header: string;
  width?: string;
  numeric?: boolean;
  sortable?: boolean;
  /** Formatea el valor crudo para mostrar (ej. separador de miles) */
  format?: (value: unknown, row: T) => string;
  cellTpl?: TemplateRef<{ $implicit: T; row: T }>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent<T> {
  columns = input.required<ColumnDef<T>[]>();
  data = input.required<T[]>();
  trackBy = input<(item: T) => string>();
  emptyMessage = input('No results');
  /** Si true, las filas son clickeables y accesibles por teclado */
  rowClickable = input(false);
  /** Clase CSS extra por fila (ej. dt-row--muted para cuotas pagadas) */
  rowClass = input<((item: T) => string | null) | undefined>();

  page = input(1);
  totalPages = input(1);
  totalItems = input(0);
  itemLabel = input('items');
  pageSizes = input<number[]>([10, 20, 50]);
  pageSizeValue = input(10);

  rowClick = output<T>();
  pageChange = output<number>();
  pageSizeChange = output<number>();

  sortKey = signal<string | null>(null);
  sortDir = signal<1 | -1>(1);

  sortedData = computed<T[]>(() => {
    const key = this.sortKey();
    if (!key) return this.data();
    const dir = this.sortDir();
    return [...this.data()].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  toggleSort(col: ColumnDef<T>) {
    if (!col.sortable) return;
    if (this.sortKey() === col.key) {
      if (this.sortDir() === 1) this.sortDir.set(-1);
      else {
        this.sortKey.set(null);
        this.sortDir.set(1);
      }
    } else {
      this.sortKey.set(col.key);
      this.sortDir.set(1);
    }
  }

  cellValue(item: T, col: ColumnDef<T>): unknown {
    const raw = (item as Record<string, unknown>)[col.key];
    return col.format ? col.format(raw, item) : raw;
  }

  onRowClick(item: T) {
    if (this.rowClickable()) this.rowClick.emit(item);
  }

  onPageChange(p: number) {
    this.pageChange.emit(p);
  }

  onPageSizeChange(size: number) {
    this.pageSizeChange.emit(size);
  }

  trackByFn(index: number, item: T): string {
    const fn = this.trackBy();
    return fn ? fn(item) : String(index);
  }
}
