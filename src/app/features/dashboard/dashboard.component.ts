import { Component, OnInit, OnDestroy, effect, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
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
        const palette = [
          accent,
          accent2,
          accent3,
          positive,
          negative,
          this.cssVar('--info') || accent2,
          this.cssVar('--warning') || accent3,
          this.cssVar('--accent-deep') || accent,
          this.cssVar('--accent-2') || accent2,
          this.cssVar('--accent-3') || accent3,
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
