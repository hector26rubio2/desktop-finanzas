import { Component, OnDestroy, effect, input, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart } from 'chart.js';
export interface DataPoint {
  label: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
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

  private chart?: Chart;

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  constructor() {
    effect(() => {
      const d = this.data();
      if (d.length > 0 && this.canvasRef?.nativeElement) {
        setTimeout(() => this.render(), 0);
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

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.labels().length ? this.labels() : d.map((p) => p.label),
        datasets: [
          {
            label: this.incomeLabel(),
            data: d.map((p) => p.income),
            borderColor: positive,
            backgroundColor: positive + '1A',
            tension: 0.3,
            fill: true,
          },
          {
            label: this.expenseLabel(),
            data: d.map((p) => p.expense),
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
}
