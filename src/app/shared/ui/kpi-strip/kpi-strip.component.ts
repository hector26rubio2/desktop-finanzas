import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpiCardData {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

@Component({
  selector: 'app-kpi-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-strip.component.html',
  styleUrl: './kpi-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  cards = input<KpiCardData[]>([]);
}