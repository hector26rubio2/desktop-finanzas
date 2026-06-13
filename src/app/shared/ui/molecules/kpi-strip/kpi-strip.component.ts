import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpiStripItem {
  label: string;
  value: string;
  sub?: string;
  /** CSS color para el valor (ej. var(--negative)) */
  color?: string;
}

/** Franja compacta de KPIs estilo header de Tarjetas: label mono uppercase + valor mono, separadores verticales. */
@Component({
  selector: 'app-kpi-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-strip.component.html',
  styleUrl: './kpi-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  items = input<KpiStripItem[]>([]);
  /** Alineación del texto de cada item: 'start' (default) o 'end' (como en Tarjetas) */
  align = input<'start' | 'end'>('start');
}
