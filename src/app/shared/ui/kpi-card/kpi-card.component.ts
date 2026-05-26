import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  label = input('');
  value = input('');
  sub = input('');
  color = input<string | null>(null);
}
