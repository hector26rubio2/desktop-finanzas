import { Component, OnInit, OnDestroy, effect, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import { AuthService } from '../../shared/services/auth/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { DashboardService, type Granularity } from '../../shared/services/dashboard.service';
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') pieCanvasRef!: ElementRef<HTMLCanvasElement>;

  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  public ds = inject(DashboardService);

  baseCurrency = this.auth.currentUser()?.baseCurrency ?? 'ARS';

  granularities: { key: Granularity; label: string }[] = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Sem' },
    { key: 'month', label: 'Mes' },
    { key: 'year', label: 'Año' },
  ];

  topLabelKey = computed(() => {
    const g = this.ds.granularity();
    return g === 'day' ? 'dashboard.fecha' : g === 'week' ? 'dashboard.concepto' : 'dashboard.mes_mas_gasto';
  });

  private lineChart?: Chart;
  private pieChart?: Chart;

  constructor() {
    effect(() => {
      const data = this.ds.lineData();
      const cats = this.ds.categoryExpenses();
      if (!this.ds.loading() && (data.length || cats.length)) {
        setTimeout(() => this.renderCharts(), 50);
      }
    });
  }

  ngOnInit() {
    this.ds.load();
  }

  ngOnDestroy() {
    this.lineChart?.destroy();
    this.pieChart?.destroy();
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private renderCharts() {
    try {
      const textColor = this.cssVar('--fg-3') || 'oklch(40% 0.008 80)';
      const gridColor = this.cssVar('--line-1') || 'oklch(100% 0 0 / 0.08)';
      const positive = this.cssVar('--positive') || 'oklch(76% 0.14 145)';
      const negative = this.cssVar('--negative') || 'oklch(70% 0.16 25)';
      const accent = this.cssVar('--accent') || 'oklch(80% 0.12 78)';
      const accent2 = this.cssVar('--accent-2') || 'oklch(78% 0.1 198)';
      const accent3 = this.cssVar('--accent-3') || 'oklch(76% 0.1 318)';

      if (this.lineCanvasRef) {
        this.lineChart?.destroy();
        const data = this.ds.lineData();
        this.lineChart = new Chart(this.lineCanvasRef.nativeElement, {
          type: 'line',
          data: {
            labels: data.map((d) => d.label),
            datasets: [
              {
                label: this.i18n.t('dashboard.ingresos'),
                data: data.map((d) => d.income),
                borderColor: positive,
                backgroundColor: positive + '1A',
                tension: 0.3,
                fill: true,
              },
              {
                label: this.i18n.t('dashboard.gastos'),
                data: data.map((d) => d.expense),
                borderColor: negative,
                backgroundColor: negative + '1A',
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

      if (this.pieCanvasRef && this.ds.categoryExpenses().length > 0) {
        this.pieChart?.destroy();
        const cats = this.ds.categoryExpenses();
        const fg0 = this.cssVar('--fg-0') || 'oklch(20% 0 0)';
        const fg1 = this.cssVar('--fg-1') || textColor;
        const bg1 = this.cssVar('--bg-1') || 'oklch(98% 0 0)';
        const bg3 = this.cssVar('--bg-3') || 'oklch(90% 0 0)';
        const line1 = this.cssVar('--line-1') || gridColor;
        const info = this.cssVar('--info') || accent2;
        const warning = this.cssVar('--warning') || accent3;
        const palette = [accent, accent2, accent3, info, positive, warning, negative];
        const colors = cats.map((_, i) => palette[i % palette.length]);
        const total = cats.reduce((s, c) => s + c.total, 0);
        const baseCcy = this.baseCurrency;

        const centerTextPlugin = {
          id: 'centerText',
          afterDraw: (chart: Chart) => {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = fg1;
            ctx.font = '500 10px "Geist Mono", monospace';
            ctx.fillText('TOTAL', cx, cy - 14);
            ctx.fillStyle = fg0;
            ctx.font = '600 18px "Geist Mono", monospace';
            ctx.fillText(new Intl.NumberFormat('es').format(Math.round(total)), cx, cy + 4);
            ctx.fillStyle = fg1;
            ctx.font = '400 9px "Geist Mono", monospace';
            ctx.fillText(baseCcy, cx, cy + 20);
            ctx.restore();
          },
        };

        const pieConfig: ChartConfiguration<'doughnut'> = {
          type: 'doughnut',
          data: {
            labels: cats.map((c) => c.name),
            datasets: [
              {
                data: cats.map((c) => c.total),
                backgroundColor: colors,
                borderColor: bg1,
                borderWidth: 2,
                hoverOffset: 8,
                hoverBorderColor: bg1,
                hoverBorderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            cutout: '68%',
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: fg1,
                  font: { family: 'Geist', size: 11 },
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 12,
                  usePointStyle: true,
                  pointStyle: 'circle',
                },
              },
              tooltip: {
                backgroundColor: bg3,
                titleColor: fg0,
                bodyColor: fg1,
                borderColor: line1,
                borderWidth: 1,
                padding: 10,
                displayColors: true,
                boxPadding: 4,
                titleFont: { family: 'Geist', size: 12, weight: 600 },
                bodyFont: { family: 'Geist Mono', size: 11 },
              },
            },
          },
          plugins: [centerTextPlugin],
        };
        this.pieChart = new Chart(this.pieCanvasRef.nativeElement, pieConfig);
      }
    } catch (e) {
      console.error('[dashboard] chart render error', e);
    }
  }
}
