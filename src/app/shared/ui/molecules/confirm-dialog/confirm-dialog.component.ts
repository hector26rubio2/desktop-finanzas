import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ModalComponent } from '../../organisms/modal/modal.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  visible = input<boolean>(false);
  title = input('');
  message = input('');
  confirmLabel = input('');
  cancelLabel = input('');
  danger = input(false);

  confirmed = output<void>();
  cancelled = output<void>();

  onConfirm() {
    this.confirmed.emit();
  }

  onCancel() {
    this.cancelled.emit();
  }
}
