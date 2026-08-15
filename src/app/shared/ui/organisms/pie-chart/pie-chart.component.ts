import { Component, OnDestroy, effect, input, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { Chart, ChartOptions, Plugin } from 'chart.js';
import '@core/chart.setup';
import { formatAmount } from '../../../utils/money';

export interface CategoryExpense {
  name: string;
  total: number;
  icon?: string;
  color?: string;
}

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [],
  templateUrl: './pie-chart.component.html',
  styleUrl: './pie-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChartComponent implements OnDestroy {
  @ViewChild('pieCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  categories = input<CategoryExpense[]>([]);
  totalLabel = input('TOTAL');
  currency = input('ARS');
  legendPosition = input<'bottom' | 'right'>('right');

  private chart?: Chart;

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  constructor() {
    effect(() => {
      if (this.categories().length > 0) {
        requestAnimationFrame(() => {
          if (this.canvasRef?.nativeElement) this.render();
        });
      }
    });
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private render() {
    this.chart?.destroy();
    const cats = this.categories();
    if (!cats.length || !this.canvasRef?.nativeElement) return;

    const fg0 = this.cssVar('--fg-0') || 'oklch(20% 0 0)';
    const fg1 = this.cssVar('--fg-1') || 'oklch(40% 0 0)';
    const bg1 = this.cssVar('--bg-1') || 'oklch(98% 0 0)';
    const bg3 = this.cssVar('--bg-3') || 'oklch(90% 0 0)';
    const line1 = this.cssVar('--line-1') || 'oklch(100% 0 0 / 0.08)';
    const accent = this.cssVar('--accent') || 'oklch(80% 0.12 78)';
    const accent2 = this.cssVar('--accent-2') || 'oklch(78% 0.1 198)';
    const accent3 = this.cssVar('--accent-3') || 'oklch(76% 0.1 318)';
    const positive = this.cssVar('--positive') || 'oklch(76% 0.14 145)';
    const info = this.cssVar('--info') || accent2;
    const warning = this.cssVar('--warning') || accent3;
    const negative = this.cssVar('--negative') || 'oklch(70% 0.16 25)';
    const palette = [accent, accent2, accent3, info, positive, warning, negative];
    const colors = cats.map((c) => c.color ?? palette[cats.indexOf(c) % palette.length]);
    const total = cats.reduce((s, c) => s + c.total, 0);
    const ccy = this.currency();

    const opts: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      cutout: '68%',
      plugins: {
        legend: {
          position: this.legendPosition(),
          labels: {
            color: fg1,
            font: { family: 'Geist', size: 11 },
            boxWidth: 10,
            boxHeight: 10,
            padding: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: bg3,
          titleColor: fg0,
          bodyColor: fg1,
          borderColor: line1,
          borderWidth: 1,
          padding: 10,
          titleFont: { family: 'Geist', size: 12 },
          bodyFont: { family: 'Geist Mono', size: 11 },
        },
      },
    };

    const centerPlugin: Plugin<'doughnut'> = {
      id: 'centerText',
      afterDraw: (chart: Chart) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const cx = (chartArea.left + chartArea.right) / 2,
          cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = fg1;
        ctx.font = '500 10px "Geist Mono"';
        ctx.fillText(this.totalLabel(), cx, cy - 14);
        ctx.fillStyle = fg0;
        ctx.font = '600 18px "Geist Mono"';
        ctx.fillText(formatAmount(Math.round(total)), cx, cy + 4);
        ctx.fillStyle = fg1;
        ctx.font = '400 9px "Geist Mono"';
        ctx.fillText(ccy, cx, cy + 20);
        ctx.restore();
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: cats.map((c) => c.name),
        datasets: [
          { data: cats.map((c) => c.total), backgroundColor: colors, borderColor: bg1, borderWidth: 2, hoverOffset: 8 },
        ],
      },
      options: opts,
      plugins: [centerPlugin],
    });
  }
}
