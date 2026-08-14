import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface FinancialBarDatum {
  key: string;
  label: string;
  value: number;
  detail?: string;
  color?: string;
}

@Component({
  selector: 'app-financial-bar-chart',
  standalone: true,
  templateUrl: './financial-bar-chart.component.html',
  styleUrl: './financial-bar-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialBarChartComponent {
  abs = Math.abs;
  data = input.required<FinancialBarDatum[]>();
  title = input.required<string>();
  currency = input('');
  selected = output<FinancialBarDatum>();
  max = computed(() => Math.max(1, ...this.data().map((x) => Math.abs(x.value))));
  accessibleSummary = computed(
    () =>
      `${this.title()}: ${this.data()
        .map((x) => `${x.label} ${x.value} ${this.currency()}`)
        .join('; ')}`,
  );
}
