import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../i18n/i18n.service';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
})
export class PaginationComponent {
  readonly i18n = inject(I18nService);
  page = input.required<number>();
  totalPages = input.required<number>();
  totalItems = input.required<number>();
  itemLabel = input('items');
  pageSizes = input<number[]>([5, 10, 15]);
  pageSize = input.required<number>();

  pageChange = output<number>();
  pageSizeChange = output<number>();

  goPrev() {
    if (this.page() > 1) this.pageChange.emit(this.page() - 1);
  }

  goNext() {
    if (this.page() < this.totalPages()) this.pageChange.emit(this.page() + 1);
  }

  changePageSize(size: number) {
    this.pageSizeChange.emit(size);
  }
}
