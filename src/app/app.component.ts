import { Component, computed, HostListener, signal, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { AuthService } from './shared/services/auth/auth.service';
import { RoleService } from './shared/services/role.service';
import { ThemeService } from './shared/services/theme.service';
import { PlatformService } from './shared/services/platform.service';
import { I18nService } from './shared/i18n/i18n.service';
import type { TranslationKey } from './shared/i18n/locale.types';
import { ICONS } from './shared/icons';

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
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  showCmdk = false;
  showNewMovement = false;
  cmdkQuery = '';

  sidebarCollapsed = signal<boolean>(
    localStorage.getItem('sidebar-collapsed') === '1',
  );

  showUserMenu = signal(false);

  toggleSidebar() {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
  }

  toggleUserMenu() {
    this.showUserMenu.set(!this.showUserMenu());
  }

  closeUserMenu() {
    this.showUserMenu.set(false);
  }

  public auth = inject(AuthService);
  public role = inject(RoleService);
  public theme = inject(ThemeService);
  public router = inject(Router);
  public os = inject(PlatformService);
  public i18n = inject(I18nService);
  private sanitizer = inject(DomSanitizer);

  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  private iconCache = computed(() => {
    const cache: Record<string, string> = {};
    for (const [name, svg] of Object.entries(ICONS)) {
      cache[name] = this.sanitizer.bypassSecurityTrustHtml(svg) as unknown as string;
    }
    return cache;
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
    });
  }

  private currentUrl = signal(this.router.url || '/login');

  activeView = computed(() => {
    const seg = this.currentUrl().split('/')[1]?.split('?')[0] ?? '';
    return seg || 'dashboard';
  });

  private readonly AUTH_ROUTES = new Set(['login', 'register', 'forgot-password', 'reset-password', 'verify-email']);

  isAuthPage = computed(() => this.AUTH_ROUTES.has(this.activeView()));

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

  headerTitle = computed(() => {
    const map: Record<string, TranslationKey> = {
      dashboard: 'header.dashboard',
      movements: 'header.movements',
      accounts: 'header.accounts',
      cards: 'header.cards',
      installments: 'header.installments',
      loans: 'header.loans',
      reports: 'header.reports',
      categories: 'header.categories',
      calendar: 'header.calendar',
      settings: 'header.settings',
      admin: 'header.admin',
    };
    return this.i18n.t(map[this.activeView()] ?? 'app.title');
  });

  headerSub = computed(() => {
    const map: Record<string, TranslationKey> = {
      dashboard: 'header_sub.dashboard',
      movements: 'header_sub.movements',
      accounts: 'header_sub.accounts',
      cards: 'header_sub.cards',
      installments: 'header_sub.installments',
      loans: 'header_sub.loans',
      reports: 'header_sub.reports',
      categories: 'header_sub.categories',
      calendar: 'header_sub.calendar',
      settings: 'header_sub.settings',
      admin: 'header_sub.admin',
    };
    return this.i18n.t(map[this.activeView()] ?? '');
  });

  private cmdkAdminItem = computed<{ id: string; label: string; kbd: string } | null>(() =>
    this.role.isAdmin() ? { id: 'admin', label: this.i18n.t('nav.admin'), kbd: '' } : null,
  );

  cmdkItems = computed(() => {
    const base = NAV_GROUPS.flatMap((g) => g.items).map((i) => ({
      id: i.id,
      label: this.i18n.t(i.key),
      kbd: i.kbd ?? '',
    }));
    const admin = this.cmdkAdminItem();
    return admin ? [...base, admin] : base;
  });

  nav(id: string, params?: Record<string, string>) {
    this.router.navigate(['/' + id], params ? { queryParams: params } : undefined);
  }

  cmdkNav(id: string) {
    this.nav(id);
    this.showCmdk = false;
    this.cmdkQuery = '';
  }

  filterCmdk() {
    void this.cmdkQuery;
    // (input) event triggers change detection, template re-evaluates matchesCmdk
  }

  iconSvg(name: string): string {
    return (this.iconCache() as Record<string, string>)[name] ?? ICONS[name] ?? '';
  }

  matchesCmdk(label: string): boolean {
    if (!this.cmdkQuery) return true;
    return label.toLowerCase().includes(this.cmdkQuery.toLowerCase());
  }

  openNewMovement() {
    this.router.navigate(['/movements']);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.showCmdk = !this.showCmdk;
    }
    if (e.key === 'Escape') {
      this.showCmdk = false;
      this.showNewMovement = false;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      this.openNewMovement();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ';') {
      e.preventDefault();
      this.theme.cycleTheme();
    }
  }
}
