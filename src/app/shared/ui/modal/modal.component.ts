import { Component, input, output, ChangeDetectionStrategy, HostListener, ElementRef, inject, effect } from '@angular/core';

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

  private el = inject(ElementRef);

  constructor() {
    effect(() => {
      this.el.nativeElement.querySelector('.overlay')?.focus();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close.emit();
  }
}
