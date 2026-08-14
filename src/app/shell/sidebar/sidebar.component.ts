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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../shared/services/auth/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ICONS } from '../../shared/icons';
import { UserMenuComponent } from '../user-menu/user-menu.component';
import { APP_NAVIGATION_GROUPS } from '../navigation.catalog';

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

  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() navigateTo = new EventEmitter<string>();
  @Output() navigateWithParams = new EventEmitter<{ path: string; queryParams?: Record<string, string> }>();
  @Output() openCmdk = new EventEmitter<void>();

  public auth = inject(AuthService);
  public i18n = inject(I18nService);
  private sanitizer = inject(DomSanitizer);

  private iconCache = computed(() => {
    const cache = new Map<string, SafeHtml>();
    for (const [name, svg] of Object.entries(ICONS)) {
      cache.set(name, this.sanitizer.bypassSecurityTrustHtml(svg));
    }
    return cache;
  });

  iconSvg(name: string): SafeHtml {
    return this.iconCache().get(name) ?? '';
  }

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
    APP_NAVIGATION_GROUPS.map((g) => ({
      label: this.i18n.t(g.key),
      items: g.items.map((i) => ({ ...i, label: this.i18n.t(i.key) })),
    })),
  );

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
      this.navigateTo.emit(event.path);
    }
    this.closeUserMenu();
  }
}
