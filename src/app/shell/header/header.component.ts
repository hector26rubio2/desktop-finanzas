import { Component, EventEmitter, inject, input, Output, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../shared/i18n/i18n.service';
import { PlatformService } from '../../shared/services/platform.service';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class ShellHeaderComponent {
  headerTitle = input.required<string>();
  headerSub = input.required<string>();

  @Output() openCmdk = new EventEmitter<void>();

  public i18n = inject(I18nService);
  public os = inject(PlatformService);
}
