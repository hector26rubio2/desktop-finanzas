import { Component, input, output, computed, ChangeDetectionStrategy, inject, viewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../i18n/i18n.service';
import { DataTableComponent, type ColumnDef } from '../data-table/data-table.component';

export interface RecentMovement {
  id: string;
  date: string;
  description: string | null;
  type: 'Income' | 'Expense';
  currency: string;
  amount: number;
}

type Tpl = TemplateRef<{ $implicit: RecentMovement; row: RecentMovement }>;

@Component({
  selector: 'app-recent-movements',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './recent-movements.component.html',
  styleUrl: './recent-movements.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentMovementsComponent {
  movements = input<RecentMovement[]>([]);
  title = input('');
  emptyLabel = input('');
  dateLabel = input('');
  conceptLabel = input('');
  typeLabel = input('');
  amountLabel = input('');
  incomeLabel = input('');
  expenseLabel = input('');
  viewAllLabel = input('');
  viewAll = output<void>();
  i18n = inject(I18nService);

  dateCell = viewChild<Tpl>('dateCell');
  typeCell = viewChild<Tpl>('typeCell');
  amountCell = viewChild<Tpl>('amountCell');

  trackById = (m: RecentMovement) => m.id;

  cols = computed<ColumnDef<RecentMovement>[]>(() => [
    { key: 'date', header: this.dateLabel(), cellTpl: this.dateCell() },
    { key: 'description', header: this.conceptLabel(), format: (v) => (v as string | null) || '—' },
    { key: 'type', header: this.typeLabel(), cellTpl: this.typeCell() },
    { key: 'amount', header: this.amountLabel(), numeric: true, cellTpl: this.amountCell() },
  ]);
}
