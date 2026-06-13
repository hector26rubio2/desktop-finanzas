import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovementResponse } from '../../../models/movement.model';
import { I18nService } from '../../../i18n/i18n.service';
import { CatIconComponent } from '../../atoms/cat-icon/cat-icon.component';
import { ModalComponent } from '../modal/modal.component';
import { FmtDatePipe } from '../../../pipes/format-date.pipe';
import { sourceLabel, subTypeLabel } from '../../../utils/movement-labels';
import { parseDate } from '../../../utils/date';

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
  /** Mostrar botón Editar (solo vistas que saben editar lo manejan) */
  editable = input(false);

  closeModal = output<void>();
  edit = output<MovementResponse>();

  public i18n = inject(I18nService);
  sourceLabel = sourceLabel;
  subTypeLabel = subTypeLabel;

  currentInstallment(m: MovementResponse): number {
    const start = parseDate(m.date);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    return Math.min(Math.max(elapsed, 1), m.loanInstallments ?? 1);
  }

  installmentPct(m: MovementResponse): number {
    if (!m.loanInstallments) return 0;
    return Math.round((this.currentInstallment(m) / m.loanInstallments) * 100);
  }

  monthlyAmount(m: MovementResponse): number {
    if (!m.loanInstallments) return m.amount;
    return m.amount / m.loanInstallments;
  }
}
