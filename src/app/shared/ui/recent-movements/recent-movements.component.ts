import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../i18n/i18n.service';

export interface RecentMovement {
  id: string;
  date: string;
  description: string | null;
  type: 'Income' | 'Expense';
  currency: string;
  amount: number;
}

@Component({
  selector: 'app-recent-movements',
  standalone: true,
  imports: [CommonModule],
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
}
