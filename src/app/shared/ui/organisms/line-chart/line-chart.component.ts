import { Component, OnDestroy, effect, input, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { Chart, ChartOptions } from 'chart.js';
import '@core/chart.setup';
export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [],
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements OnDestroy {
  @ViewChild('lineCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  data = input<DataPoint[]>([]);
  labels = input<string[]>([]);
  incomeLabel = input('Income');
  expenseLabel = input('Expense');
  maxTicksLimit = input(15);
  yMin = input<number | undefined>(undefined);
  yMax = input<number | undefined>(undefined);

  private chart?: Chart;

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  constructor() {
    effect(() => {
      if (this.data().length > 0) {
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
    const d = this.data();
    if (!d.length || !this.canvasRef?.nativeElement) return;

    const textColor = this.cssVar('--fg-3') || 'oklch(40% 0.008 80)';
    const gridColor = this.cssVar('--line-1') || 'oklch(100% 0 0 / 0.08)';
    const positive = this.cssVar('--positive') || 'oklch(76% 0.14 145)';
    const negative = this.cssVar('--negative') || 'oklch(70% 0.16 25)';

    const maxTicks = this.maxTicksLimit();
    const uMin = this.yMin();
    const uMax = this.yMax();

    const opts: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      layout: { padding: { left: 4, right: 8, top: 8, bottom: 4 } },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: this.cssVar('--bg-3') || 'oklch(90% 0 0)',
          titleColor: this.cssVar('--fg-0') || 'oklch(20% 0 0)',
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          padding: 8,
          titleFont: { family: 'Geist', size: 11 },
          bodyFont: { family: 'Geist Mono', size: 11 },
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
              `${ctx.dataset.label}: ${new Intl.NumberFormat('es').format(Math.round(ctx.parsed.y ?? 0))}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font: { family: 'Geist Mono', size: 10 },
            maxTicksLimit: maxTicks,
            autoSkip: true,
          },
          grid: { color: gridColor, drawTicks: false },
          border: { color: gridColor },
        },
        y: {
          ...(uMin !== undefined ? { min: uMin } : {}),
          ...(uMax !== undefined ? { suggestedMax: uMax } : {}),
          ticks: {
            color: textColor,
            font: { family: 'Geist Mono', size: 10 },
            callback: (v: string | number) => new Intl.NumberFormat('es', { notation: 'compact' }).format(Number(v)),
          },
          grid: { color: gridColor, drawTicks: false },
          border: { color: gridColor },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.labels().length ? this.labels() : d.map((p) => p.label),
        datasets: [
          {
            label: this.incomeLabel(),
            data: d.map((p) => p.income),
            borderColor: positive,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHoverBackgroundColor: positive,
            tension: 0.15,
            fill: false,
          },
          {
            label: this.expenseLabel(),
            data: d.map((p) => p.expense),
            borderColor: negative,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHoverBackgroundColor: negative,
            tension: 0.15,
            fill: false,
          },
        ],
      },
      options: opts,
    });
  }
}
