import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { forkJoin } from 'rxjs';

interface MonthStat {
  month: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent implements OnInit {
  tab = signal<'overview' | 'cat' | 'mom'>('overview');
  loading = signal(true);
  monthStats = signal<MonthStat[]>([]);
  income12 = signal(0);
  expense12 = signal(0);
  maxExpense = signal(0);

  private api = inject(ApiService);
  public i18n = inject(I18nService);

  ngOnInit() {
    const now = new Date();
    const requests = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    forkJoin(requests.map((ym) => this.api.getMovementSummary(ym))).subscribe((sums) => {
      const stats = sums.map((s, i) => ({ month: requests[i], income: s.totalIncome, expense: s.totalExpense }));
      this.monthStats.set(stats);
      this.income12.set(stats.reduce((a, s) => a + s.income, 0));
      this.expense12.set(stats.reduce((a, s) => a + s.expense, 0));
      this.maxExpense.set(Math.max(...stats.map((s) => s.expense), 1));
      this.loading.set(false);
    });
  }
}
