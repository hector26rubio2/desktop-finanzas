import { Component, OnInit, signal, ElementRef, ViewChild, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/services/i18n.service';
import { ThemeService } from '../shared/services/theme.service';
import { forkJoin } from 'rxjs';

Chart.register(...registerables);

interface MonthStat {
  month: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="layout">
      <header>
        <h2>{{ i18n.t('dashboard') }}</h2>
        <div class="header-right">
          <button (click)="router.navigate(['/movements'])">← {{ i18n.t('movements') }}</button>
          <button (click)="theme.toggle()">{{ theme.isDarkTheme() ? '☀️' : '🌙' }}</button>
          <button (click)="auth.logout()" class="danger">{{ i18n.t('logout') }}</button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading">{{ i18n.t('loading') }}</div>
      }

      @if (!loading()) {
        <div>
          <!-- Top stat -->
          <div class="stat-cards">
            @if (topMonth()) {
              <div class="stat-card">
                <div class="stat-label">{{ i18n.t('topSpendMonth') }}</div>
                <div class="stat-value expense">{{ topMonth() }}</div>
                <div class="stat-sub">{{ topMonthAmount() | number: '1.0-0' }} {{ baseCurrency }}</div>
              </div>
            }
            <div class="stat-card">
              <div class="stat-label">{{ i18n.t('totalIncome') }} (12 meses)</div>
              <div class="stat-value income">{{ totalIncome12() | number: '1.0-0' }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ i18n.t('totalExpense') }} (12 meses)</div>
              <div class="stat-value expense">{{ totalExpense12() | number: '1.0-0' }}</div>
            </div>
          </div>
          <!-- Line chart -->
          <div class="chart-card">
            <h3>{{ i18n.t('monthlyChart') }}</h3>
            <canvas #lineCanvas height="120"></canvas>
          </div>
          <!-- Pie chart -->
          <div class="chart-card">
            <h3>{{ i18n.t('categoryChart') }}</h3>
            <div class="pie-wrap">
              <canvas #pieCanvas width="300" height="300"></canvas>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stat-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .stat-card {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 1rem;
        box-shadow: var(--card-shadow);
      }
      .stat-label {
        font-size: 0.78rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 0.25rem;
      }
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
      }
      .stat-sub {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 0.1rem;
      }
      .income {
        color: var(--income);
      }
      .expense {
        color: var(--expense);
      }
      .chart-card {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        box-shadow: var(--card-shadow);
      }
      .chart-card h3 {
        margin: 0 0 1rem;
        font-size: 0.95rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pie-wrap {
        display: flex;
        justify-content: center;
        max-height: 300px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') pieCanvasRef!: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  monthStats = signal<MonthStat[]>([]);
  categoryExpenses = signal<{ name: string; total: number }[]>([]);
  baseCurrency = this.auth.currentUser()?.baseCurrency ?? 'COP';

  topMonth = signal('');
  topMonthAmount = signal(0);
  totalIncome12 = signal(0);
  totalExpense12 = signal(0);

  private lineChart?: Chart;
  private pieChart?: Chart;

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private api = inject(ApiService);

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.lineChart?.destroy();
    this.pieChart?.destroy();
  }

  private loadData() {
    const now = new Date();
    const requests = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, d };
    });

    forkJoin(requests.map((r) => this.api.getMovementSummary(r.ym))).subscribe((summaries) => {
      const stats: MonthStat[] = summaries.map((s, i) => ({
        month: requests[i].ym,
        income: s.totalIncome,
        expense: s.totalExpense,
      }));
      this.monthStats.set(stats);

      const income12 = stats.reduce((a, s) => a + s.income, 0);
      const expense12 = stats.reduce((a, s) => a + s.expense, 0);
      this.totalIncome12.set(income12);
      this.totalExpense12.set(expense12);

      const top = stats.reduce((a, b) => (b.expense > a.expense ? b : a), stats[0]);
      this.topMonth.set(top.month);
      this.topMonthAmount.set(top.expense);

      this.loading.set(false);

      // Load current month movements for category chart
      this.api.getMovements(requests[11].ym, 1, 200).subscribe((page) => {
        const catMap = new Map<string, number>();
        page.items
          .filter((m) => m.type === 'Expense')
          .forEach((m) => {
            const key = m.categoryName ?? 'Sin categoría';
            catMap.set(key, (catMap.get(key) ?? 0) + m.amountBase);
          });
        this.categoryExpenses.set(
          [...catMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        );
        setTimeout(() => this.renderCharts(), 50);
      });
    });
  }

  private renderCharts() {
    const isDark = this.theme.isDarkTheme();
    const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
    const textColor = isDark ? '#94a3b8' : '#6b7280';

    // Line chart
    if (this.lineCanvasRef) {
      this.lineChart?.destroy();
      const stats = this.monthStats();
      this.lineChart = new Chart(this.lineCanvasRef.nativeElement, {
        type: 'line',
        data: {
          labels: stats.map((s) => s.month.slice(5) + '/' + s.month.slice(2, 4)),
          datasets: [
            {
              label: this.i18n.t('totalIncome'),
              data: stats.map((s) => s.income),
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.1)',
              tension: 0.3,
              fill: true,
            },
            {
              label: this.i18n.t('totalExpense'),
              data: stats.map((s) => s.expense),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,.1)',
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } },
          },
        },
      });
    }

    // Pie chart
    if (this.pieCanvasRef && this.categoryExpenses().length > 0) {
      this.pieChart?.destroy();
      const cats = this.categoryExpenses();
      const palette = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
      this.pieChart = new Chart(this.pieCanvasRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: cats.map((c) => c.name),
          datasets: [{ data: cats.map((c) => c.total), backgroundColor: palette.slice(0, cats.length) }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 14 } } },
        },
      });
    }
  }
}
