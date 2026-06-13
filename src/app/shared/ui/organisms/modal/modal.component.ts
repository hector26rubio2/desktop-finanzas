import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
  effect,
  OnDestroy,
} from '@angular/core';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent implements OnDestroy {
  title = input('');
  ariaLabel = input('');
  closeModal = output<void>();
  overlayClick = output<void>();

  private el = inject(ElementRef);
  private previouslyFocused: HTMLElement | null =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor() {
    effect(() => {
      this.el.nativeElement.querySelector('.overlay')?.focus();
    });
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeModal.emit();
  }

  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  trapFocus(e: Event) {
    const event = e as KeyboardEvent;
    const focusables = Array.from(
      this.el.nativeElement.querySelectorAll(FOCUSABLE_SELECTOR) as NodeListOf<HTMLElement>,
    ).filter((n) => n.offsetParent !== null);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const inside = this.el.nativeElement.contains(active);

    if (!inside) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
