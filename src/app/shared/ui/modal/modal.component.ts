import { Component, input, output, ChangeDetectionStrategy, HostListener } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  title = input('');
  ariaLabel = input('');
  close = output<void>();
  overlayClick = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close.emit();
  }
}
