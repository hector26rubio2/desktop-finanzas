import { Component, input, output, ChangeDetectionStrategy, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../pagination/pagination.component';

export interface ColumnDef<T> {
  key: keyof T & string;
  header: string;
  width?: string;
  numeric?: boolean;
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

  page = input(1);
  totalPages = input(1);
  totalItems = input(0);
  itemLabel = input('items');
  pageSizes = input<number[]>([5, 10, 15]);
  pageSizeValue = input(10);

  rowClick = output<T>();
  pageChange = output<number>();
  pageSizeChange = output<number>();

  cellValue(item: T, key: string): unknown {
    return (item as Record<string, unknown>)[key];
  }

  onRowClick(item: T) {
    this.rowClick.emit(item);
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
