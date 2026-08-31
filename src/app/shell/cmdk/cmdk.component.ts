import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth/auth.service';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ApiService, AccountResponse, CategoryResponse } from '../../shared/services/api.service';
import { APP_NAVIGATION_ITEMS } from '../navigation.catalog';

export interface CmdkResult {
  id: string;
  kind: 'nav' | 'action' | 'account' | 'category';
  label: string;
  sub?: string;
  kbd?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-cmdk',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmdk.component.html',
  styleUrl: './cmdk.component.css',
})
export class CmdkComponent implements OnChanges {
  @Input() visible = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() navigateTo = new EventEmitter<string>();
  @Output() newMovement = new EventEmitter<void>();

  query = signal('');
  activeIndex = signal(0);
  private accounts = signal<AccountResponse[]>([]);
  private categories = signal<CategoryResponse[]>([]);
  private dataLoaded = false;

  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  ngOnChanges() {
    if (this.visible) {
      this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.activeIndex.set(0);
      setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('.cmdk__input')?.focus());
      if (!this.dataLoaded) {
        this.dataLoaded = true;
        this.api
          .getAccounts()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (a) => this.accounts.set(a), error: () => {} });
        this.api
          .getCategories()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (c) => this.categories.set(c), error: () => {} });
      }
    } else {
      this.previouslyFocused?.focus({ preventScroll: true });
      this.previouslyFocused = null;
    }
  }

  private navResults = computed<CmdkResult[]>(() => {
    return APP_NAVIGATION_ITEMS.map((i) => ({
      id: i.id,
      kind: 'nav' as const,
      label: this.i18n.t(i.key),
      kbd: i.kbd ?? '',
    }));
  });

  private actionResults = computed<CmdkResult[]>(() => [
    { id: 'new-movement', kind: 'action', label: this.i18n.t('cmdk.new_movement') },
    { id: 'theme', kind: 'action', label: this.i18n.t('cmdk.change_theme') },
    { id: 'logout', kind: 'action', label: this.i18n.t('common.sign_out'), danger: true },
  ]);

  results = computed<CmdkResult[]>(() => {
    const q = this.query().toLowerCase().trim();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const nav = this.navResults().filter((r) => match(r.label));
    const actions = this.actionResults().filter((r) => match(r.label));

    const accounts: CmdkResult[] = !q
      ? []
      : this.accounts()
          .filter((a) => match(a.name) || match(a.bank ?? ''))
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            kind: 'account' as const,
            label: a.name,
            sub: `${a.bank ?? ''} ${a.currency}`.trim(),
          }));
    const categories: CmdkResult[] = !q
      ? []
      : this.categories()
          .filter((c) => match(this.i18n.catName(c.name, c.translations)))
          .slice(0, 5)
          .map((c) => ({
            id: c.id,
            kind: 'category' as const,
            label: this.i18n.catName(c.name, c.translations),
            sub: c.type === 'Income' ? this.i18n.t('transactions.income') : this.i18n.t('transactions.expense'),
          }));
    return [...nav, ...accounts, ...categories, ...actions];
  });

  sectionLabel(kind: CmdkResult['kind']): string {
    if (kind === 'nav') return this.i18n.t('cmdk.go_to');
    if (kind === 'account') return this.i18n.t('nav.accounts');
    if (kind === 'category') return this.i18n.t('nav.categories');
    return this.i18n.t('cmdk.actions');
  }

  showSection(index: number): boolean {
    const list = this.results();
    return index === 0 || list[index].kind !== list[index - 1].kind;
  }

  onQueryChange(value: string) {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onKeydown(e: KeyboardEvent) {
    const list = this.results();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex.set(Math.min(this.activeIndex() + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = list[this.activeIndex()];
      if (item) this.select(item);
    }
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.requestClose();
  }

  onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  requestClose() {
    this.closeModal.emit();
  }

  select(item: CmdkResult) {
    if (item.kind === 'nav') {
      this.navigateTo.emit(item.id);
    } else if (item.kind === 'account') {
      this.navigateTo.emit('accounts');
    } else if (item.kind === 'category') {
      this.navigateTo.emit('categories');
    } else if (item.id === 'new-movement') {
      this.newMovement.emit();
    } else if (item.id === 'theme') {
      this.theme.cycleTheme();
    } else if (item.id === 'logout') {
      this.auth.logout();
    }
    this.requestClose();
    this.query.set('');
    this.activeIndex.set(0);
  }
}
