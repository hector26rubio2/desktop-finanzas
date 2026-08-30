import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../i18n/i18n.service';
export interface InspectorSection {
  title: string;
  rows: Array<{ label: string; value: string }>;
}
export interface InspectorAction {
  id: string;
  label: string;
  danger?: boolean;
}
@Component({
  selector: 'app-inspector-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspector-panel.component.html',
  styleUrl: './inspector-panel.component.css',
})
export class InspectorPanelComponent {
  readonly i18n = inject(I18nService);
  open = input(false);
  title = input('Detalle');
  subtitle = input('');
  sections = input<InspectorSection[]>([]);
  actions = input<InspectorAction[]>([]);
  closed = output<void>();
  action = output<string>();
}
