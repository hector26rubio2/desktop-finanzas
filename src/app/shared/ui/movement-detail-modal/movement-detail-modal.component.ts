import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovementResponse } from '../../models/movement.model';
import { I18nService } from '../../i18n/i18n.service';
import { CatIconComponent } from '../cat-icon/cat-icon.component';
import { ModalComponent } from '../modal/modal.component';
import { FmtDatePipe } from '../../pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../utils/movement-labels';

@Component({
  selector: 'app-movement-detail-modal',
  standalone: true,
  imports: [CommonModule, CatIconComponent, ModalComponent, FmtDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-detail-modal.component.html',
  styleUrl: './movement-detail-modal.component.css',
})
export class MovementDetailModalComponent {
  movement = input<MovementResponse | null>(null);

  closeModal = output<void>();

  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;
}
