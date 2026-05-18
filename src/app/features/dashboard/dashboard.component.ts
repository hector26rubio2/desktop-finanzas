import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ApiService, MovementResponse } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/i18n/i18n.service';

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
    <div class="view">
      @if (loading()) {
        <div class="empty-state">
          <div
            class="loading-dot"
            style="width:10px;height:10px;border-radius:50%;background:var(--accent);animation:pulse 1.2s ease-in-out infinite"
          ></div>
          <p style="margin-top:12px;font-size:12px;color:var(--fg-3)">{{ i18n.t('dashboard.cargando') }}</p>
        </div>
      } @else {
        <!-- KPI Strip -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('dashboard.balance_total') }}</div>
            <div class="num-lg" style="margin-top:8px">{{ totalIncome12() - totalExpense12() | number: '1.0-0' }}</div>
            <div class="num-sm">{{ baseCurrency }}</div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('dashboard.ingresos_12m') }}</div>
            <div class="num-md" style="margin-top:8px;color:var(--positive)">
              {{ totalIncome12() | number: '1.0-0' }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('dashboard.gastos_12m') }}</div>
            <div class="num-md" style="margin-top:8px;color:var(--negative)">
              {{ totalExpense12() | number: '1.0-0' }}
            </div>
          </div>
          @if (topMonth()) {
            <div class="kpi-card">
              <div class="eyebrow">{{ i18n.t('dashboard.mes_mas_gasto') }}</div>
              <div class="num-md mono" style="margin-top:8px">{{ topMonth() }}</div>
              <div class="num-sm">{{ topMonthAmount() | number: '1.0-0' }} {{ baseCurrency }}</div>
            </div>
          }
        </div>

        <!-- Charts grid -->
        <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:var(--gutter)">
          <!-- Line chart -->
          <div class="card">
            <div class="card__h">
              <span class="card__title">{{ i18n.t('dashboard.cashflow_title') }}</span>
              <div style="display:flex;gap:10px;font-family:'Geist Mono',monospace;font-size:10px">
                <span style="color:var(--positive)">● {{ i18n.t('dashboard.ingresos') }}</span>
                <span style="color:var(--negative)">● {{ i18n.t('dashboard.gastos') }}</span>
              </div>
            </div>
            <div style="padding:16px">
              <canvas #lineCanvas height="200"></canvas>
            </div>
          </div>
          <!-- Donut -->
          <div class="card">
            <div class="card__h">
              <span class="card__title">{{ i18n.t('dashboard.gastos_categoria') }}</span>
              <span class="eyebrow">{{ i18n.t('dashboard.este_mes') }}</span>
            </div>
            <div style="padding:16px;display:flex;justify-content:center">
              @if (categoryExpenses().length > 0) {
                <canvas #pieCanvas width="260" height="260"></canvas>
              } @else {
                <div class="empty-state" style="padding:40px">
                  <p>{{ i18n.t('dashboard.sin_datos') }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Recent transactions -->
        <div class="card">
          <div class="card__h">
            <span class="card__title">{{ i18n.t('dashboard.movimientos_recientes') }}</span>
            <button class="btn btn--ghost" style="font-size:11px" (click)="router.navigate(['/movimientos'])">
              {{ i18n.t('dashboard.ver_todos') }}
            </button>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th style="width:90px">{{ i18n.t('dashboard.fecha') }}</th>
                <th>{{ i18n.t('dashboard.concepto') }}</th>
                <th>{{ i18n.t('dashboard.tipo') }}</th>
                <th class="num">{{ i18n.t('dashboard.monto') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (m of recentMovements(); track m.id) {
                <tr>
                  <td class="mono subtle" style="font-size:11px;letter-spacing:.04em">{{ m.date }}</td>
                  <td>{{ m.description ?? '—' }}</td>
                  <td>
                    <span class="tag" [class]="m.type === 'Income' ? 'tag--pos' : 'tag--neg'">
                      {{ m.type === 'Income' ? i18n.t('dashboard.ingresos') : i18n.t('dashboard.gastos') }}
                    </span>
                  </td>
                  <td class="num mono" [style.color]="m.type === 'Income' ? 'var(--positive)' : 'var(--fg-0)'">
                    {{ m.type === 'Income' ? '+' : '−' }}{{ m.amount | number: '1.2-2' }} {{ m.currency }}
                  </td>
                </tr>
              }
              @if (recentMovements().length === 0) {
                <tr>
                  <td colspan="4" class="empty-state" style="padding:40px;text-align:center">
                    {{ i18n.t('dashboard.sin_movimientos') }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') pieCanvasRef!: ElementRef<HTMLCanvasElement>;

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private api = inject(ApiService);

  loading = signal(true);
  monthStats = signal<MonthStat[]>([]);
  categoryExpenses = signal<{ name: string; total: number }[]>([]);
  recentMovements = signal<MovementResponse[]>([]);
  baseCurrency = this.auth.currentUser()?.baseCurrency ?? 'ARS';
  topMonth = signal('');
  topMonthAmount = signal(0);
  totalIncome12 = signal(0);
  totalExpense12 = signal(0);

  private lineChart?: Chart;
  private pieChart?: Chart;

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

    console.log(
      '[dashboard] loading data for',
      requests.map((r) => r.ym),
    );

    forkJoin(requests.map((r) => this.api.getMovementSummary(r.ym))).subscribe({
      next: (summaries) => {
        console.log('[dashboard] summaries received', JSON.stringify(summaries));

        const stats: MonthStat[] = summaries.map((s, i) => ({
          month: requests[i].ym,
          income: s?.totalIncome ?? 0,
          expense: s?.totalExpense ?? 0,
        }));
        this.monthStats.set(stats);
        this.totalIncome12.set(stats.reduce((a, s) => a + s.income, 0));
        this.totalExpense12.set(stats.reduce((a, s) => a + s.expense, 0));

        const top = stats.reduce((a, b) => (b.expense > a.expense ? b : a), stats[0]);
        this.topMonth.set(top?.month ?? '');
        this.topMonthAmount.set(top?.expense ?? 0);

        this.loading.set(false);

        this.api.getMovements(requests[11].ym, 1, 200).subscribe({
          next: (page) => {
            console.log('[dashboard] recent movements count', page?.items?.length);
            this.recentMovements.set(page?.items?.slice(0, 8) ?? []);
            const catMap = new Map<string, number>();
            (page?.items ?? [])
              .filter((m: MovementResponse) => m.type === 'Expense')
              .forEach((m: MovementResponse) => {
                const key = m.categoryName ?? this.i18n.t('dashboard.sin_categoria');
                catMap.set(key, (catMap.get(key) ?? 0) + (m.amountBase ?? 0));
              });
            this.categoryExpenses.set(
              [...catMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
            );
            setTimeout(() => this.renderCharts(), 50);
          },
          error: (err) => {
            console.error('[dashboard] getMovements failed', err);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('[dashboard] getMovementSummary failed', err);
        this.loading.set(false);
      },
    });
  }

  private renderCharts() {
    try {
      const textColor = 'oklch(40% 0.008 80)';
      const gridColor = 'oklch(100% 0 0 / 0.08)';

      if (this.lineCanvasRef) {
        this.lineChart?.destroy();
        const stats = this.monthStats();
        this.lineChart = new Chart(this.lineCanvasRef.nativeElement, {
          type: 'line',
          data: {
            labels: stats.map((s) => s.month.slice(5) + '/' + s.month.slice(2, 4)),
            datasets: [
              {
                label: this.i18n.t('dashboard.ingresos'),
                data: stats.map((s) => s.income),
                borderColor: 'oklch(76% 0.14 145)',
                backgroundColor: 'oklch(76% 0.14 145 / 0.08)',
                tension: 0.3,
                fill: true,
              },
              {
                label: this.i18n.t('dashboard.gastos'),
                data: stats.map((s) => s.expense),
                borderColor: 'oklch(70% 0.16 25)',
                backgroundColor: 'oklch(70% 0.16 25 / 0.08)',
                tension: 0.3,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: textColor, font: { family: 'Geist Mono', size: 10 } }, grid: { color: gridColor } },
              y: { ticks: { color: textColor, font: { family: 'Geist Mono', size: 10 } }, grid: { color: gridColor } },
            },
          },
        });
      }

      if (this.pieCanvasRef && this.categoryExpenses().length > 0) {
        this.pieChart?.destroy();
        const cats = this.categoryExpenses();
        const palette = [
          'oklch(80% 0.12 78)',
          'oklch(70% 0.16 25)',
          'oklch(72% 0.13 235)',
          'oklch(76% 0.14 145)',
          'oklch(80% 0.14 60)',
          'oklch(75% 0.13 320)',
          'oklch(72% 0.13 162)',
          'oklch(70% 0.14 280)',
        ];
        this.pieChart = new Chart(this.pieCanvasRef.nativeElement, {
          type: 'doughnut',
          data: {
            labels: cats.map((c) => c.name),
            datasets: [
              { data: cats.map((c) => c.total), backgroundColor: palette.slice(0, cats.length), borderWidth: 0 },
            ],
          },
          options: {
            responsive: true,
            animation: false,
            cutout: '68%',
            plugins: {
              legend: {
                position: 'right',
                labels: { color: textColor, font: { family: 'Geist Mono', size: 10 }, boxWidth: 10, padding: 10 },
              },
            },
          },
        });
      }
    } catch (e) {
      console.error('[dashboard] chart render error', e);
    }
  }
}
