import { Component, OnInit, OnDestroy, effect, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../../shared/services/auth/auth.service';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { DashboardService, type Granularity } from '../../shared/services/dashboard.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvas') pieCanvasRef!: ElementRef<HTMLCanvasElement>;

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  public ds = inject(DashboardService);

  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

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

  private renderCharts() {
    try {
      const textColor = 'oklch(40% 0.008 80)';
      const gridColor = 'oklch(100% 0 0 / 0.08)';

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
                borderColor: 'oklch(76% 0.14 145)',
                backgroundColor: 'oklch(76% 0.14 145 / 0.08)',
                tension: 0.3,
                fill: true,
              },
              {
                label: this.i18n.t('dashboard.gastos'),
                data: data.map((d) => d.expense),
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

      if (this.pieCanvasRef && this.ds.categoryExpenses().length > 0) {
        this.pieChart?.destroy();
        const cats = this.ds.categoryExpenses();
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
