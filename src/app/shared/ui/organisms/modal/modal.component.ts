import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
  afterNextRender,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../../i18n/i18n.service';

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
  readonly i18n = inject(I18nService);
  title = input('');
  ariaLabel = input('');
  size = input<'md' | 'lg'>('md');
  closeModal = output<void>();
  overlayClick = output<void>();
  readonly titleId = `app-modal-title-${ModalComponent.nextId++}`;
  private static nextId = 0;

  private el = inject(ElementRef);
  private dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private previouslyFocused: HTMLElement | null =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog()?.nativeElement;
      if (dialog && !dialog.open) dialog.showModal();
      const host = this.el.nativeElement as HTMLElement;
      const firstControl = host.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstControl ?? host.querySelector<HTMLElement>('.overlay'))?.focus();
    });
  }

  ngOnDestroy(): void {
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.previouslyFocused?.focus();
  }

  onEscape(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.closeModal.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    this.overlayClick.emit();
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
