import {
  Component,
  computed,
  EventEmitter,
  inject,
  input,
  Output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService } from '../../shared/services/auth/auth.service';
import { RoleService } from '../../shared/services/role.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { TranslationKey } from '../../shared/i18n/locale.types';
import { ICONS } from '../../shared/icons';
import { UserMenuComponent } from '../user-menu/user-menu.component';

interface NavItem {
  id: string;
  key: TranslationKey;
  icon: string;
  badge?: string;
  dot?: boolean;
  kbd?: string;
}
interface NavGroup {
  key: TranslationKey;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'nav.vista_general',
    items: [
      { id: 'dashboard', key: 'nav.dashboard', icon: 'dashboard', kbd: 'g d' },
      { id: 'movements', key: 'nav.movements', icon: 'list', kbd: 'g m' },
      { id: 'calendar', key: 'nav.calendar', icon: 'calendar' },
    ],
  },
  {
    key: 'nav.accounts',
    items: [
      { id: 'accounts', key: 'nav.accounts', icon: 'account', kbd: 'g a' },
      { id: 'cards', key: 'nav.cards', icon: 'card', kbd: 'g t' },
      { id: 'installments', key: 'nav.installments', icon: 'installments', dot: true, kbd: 'g c' },
      { id: 'loans', key: 'nav.loans', icon: 'loan' },
    ],
  },
  {
    key: 'nav.analisis',
    items: [
      { id: 'reports', key: 'nav.reports', icon: 'reports', kbd: 'g r' },
      { id: 'categories', key: 'nav.categories', icon: 'category', kbd: 'g k' },
    ],
  },
  { key: 'nav.app', items: [{ id: 'settings', key: 'nav.settings', icon: 'settings', kbd: 'g s' }] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, UserMenuComponent],
  host: { style: 'display: contents' },
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  collapsed = input.required<boolean>();
  activeView = input.required<string>();
  showUserMenu = signal(false);

  @Output() toggle = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<string>();
  @Output() navigateWithParams = new EventEmitter<{ path: string; queryParams?: Record<string, string> }>();
  @Output() openCmdk = new EventEmitter<void>();

  public auth = inject(AuthService);
  public role = inject(RoleService);
  public i18n = inject(I18nService);
  private sanitizer = inject(DomSanitizer);

  private iconCache = computed(() => {
    const cache: Record<string, string> = {};
    for (const [name, svg] of Object.entries(ICONS)) {
      cache[name] = this.sanitizer.bypassSecurityTrustHtml(svg) as unknown as string;
    }
    return cache;
  });

  userName = computed(() => this.auth.currentUser()?.name ?? 'Usuario');
  userEmail = computed(() => this.auth.currentUser()?.email ?? '');
  userInitials = computed(() => {
    const n = this.auth.currentUser()?.name ?? 'U';
    return n
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  });

  navGroups = computed(() =>
    NAV_GROUPS.map((g) => ({
      label: this.i18n.t(g.key),
      items: g.items.map((i) => ({ ...i, label: this.i18n.t(i.key) })),
    })),
  );

  iconSvg(name: string): string {
    return (this.iconCache() as Record<string, string>)[name] ?? ICONS[name] ?? '';
  }

  toggleUserMenu() {
    this.showUserMenu.update((v) => !v);
  }
  closeUserMenu() {
    this.showUserMenu.set(false);
  }

  onUserMenuNavigate(event: { path: string; queryParams?: Record<string, string> }) {
    if (event.queryParams) {
      this.navigateWithParams.emit(event);
    } else {
      this.navigate.emit(event.path);
    }
    this.closeUserMenu();
  }
}
