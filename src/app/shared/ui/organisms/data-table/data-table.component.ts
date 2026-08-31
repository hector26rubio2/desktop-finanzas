import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  TemplateRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../../molecules/pagination/pagination.component';
import { SkeletonComponent } from '../../atoms/skeleton/skeleton.component';
import { I18nService } from '../../../i18n/i18n.service';

export interface ColumnDef<T> {
  key: keyof T & string;
  header: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  numeric?: boolean;
  sortable?: boolean;
  wrap?: boolean;
  priority?: 'high' | 'medium' | 'low';

  format?: (value: unknown, row: T) => string;
  cellTpl?: TemplateRef<{ $implicit: T; row: T }>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent<T> {
  readonly i18n = inject(I18nService);
  columns = input.required<ColumnDef<T>[]>();
  data = input.required<T[]>();
  trackBy = input<(item: T) => string>();
  emptyMessage = input('');
  loading = input(false);
  errorMessage = input('');
  searchable = input(false);
  searchPlaceholder = input('');
  pagination = input(true);
  caption = input('');
  minTableWidth = input('720px');
  maxBodyHeight = input('clamp(240px, 48vh, 560px)');

  rowClickable = input(false);

  rowClass = input<((item: T) => string | null) | undefined>();

  page = input(1);
  totalPages = input<number | null>(null);
  totalItems = input<number | null>(null);
  itemLabel = input('');
  pageSizes = input<number[]>([10, 20, 50]);
  pageSizeValue = input(10);

  rowClick = output<T>();
  pageChange = output<number>();
  pageSizeChange = output<number>();

  sortKey = signal<string | null>(null);
  sortDir = signal<1 | -1>(1);
  query = signal('');
  hiddenColumns = signal<Set<string>>(new Set());

  visibleColumns = computed(() => this.columns().filter((x) => !this.hiddenColumns().has(x.key)));
  resolvedEmptyMessage = computed(() => this.emptyMessage() || this.i18n.t('common.no_results'));
  resolvedSearchPlaceholder = computed(() => this.searchPlaceholder() || this.i18n.t('common.search'));
  resolvedItemLabel = computed(() => this.itemLabel() || this.i18n.t('common.items'));
  resolvedTotalItems = computed(() => this.totalItems() ?? this.sortedData().length);
  resolvedTotalPages = computed(
    () => this.totalPages() ?? Math.max(1, Math.ceil(this.resolvedTotalItems() / this.pageSizeValue())),
  );

  sortedData = computed<T[]>(() => {
    const key = this.sortKey();
    const q = this.query().trim().toLocaleLowerCase();
    const filtered = q
      ? this.data().filter((item) =>
          Object.values(item as Record<string, unknown>).some((value) =>
            String(value ?? '')
              .toLocaleLowerCase()
              .includes(q),
          ),
        )
      : this.data();
    if (!key) return filtered;
    const dir = this.sortDir();
    return [...filtered].sort((a, b) => {
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

  toggleColumn(key: string) {
    const next = new Set(this.hiddenColumns());
    if (next.has(key)) next.delete(key);
    else {
      if (this.visibleColumns().length <= 1) return;
      next.add(key);
    }
    this.hiddenColumns.set(next);
  }

  cellValue(item: T, col: ColumnDef<T>): unknown {
    const raw = (item as Record<string, unknown>)[col.key];
    return col.format ? col.format(raw, item) : raw;
  }

  cellTitle(item: T, col: ColumnDef<T>): string | null {
    if (col.cellTpl) return null;
    const value = this.cellValue(item, col);
    return value == null ? null : String(value);
  }

  columnClasses(col: ColumnDef<T>): Record<string, boolean> {
    return {
      'dt-col--wrap': !!col.wrap,
      'dt-col--priority-medium': col.priority === 'medium',
      'dt-col--priority-low': col.priority === 'low',
    };
  }

  onRowClick(item: T) {
    if (this.rowClickable()) this.rowClick.emit(item);
  }

  onRowKeydown(event: KeyboardEvent, item: T) {
    if (!this.rowClickable() || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
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
