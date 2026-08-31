import { Component, computed, HostListener, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Router,
  RouterOutlet,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './shared/services/auth/auth.service';
import { I18nService } from './shared/i18n/i18n.service';
import { SidebarComponent } from './shell/sidebar/sidebar.component';
import { ShellHeaderComponent } from './shell/header/header.component';
import { CmdkComponent } from './shell/cmdk/cmdk.component';
import { APP_NAVIGATION_BY_ID } from './shell/navigation.catalog';
import { UpdateBannerComponent } from './shared/ui/organisms/update-banner/update-banner.component';
import { UpdateService } from './shared/services/update/update.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CommonModule, SidebarComponent, ShellHeaderComponent, CmdkComponent, UpdateBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  showCmdk = signal(false);
  sidebarCollapsed = signal(localStorage.getItem('sidebar-collapsed') === '1');
  routeLoading = signal(false);

  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  public update = inject(UpdateService);
  public notif = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private routeLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  private currentUrl = signal(this.router.url || '/login');

  private AUTH_ROUTES = new Set(['login', 'register', 'recover']);

  activeView = computed(() => {
    const seg = this.currentUrl().split('/')[1]?.split('?')[0] ?? '';
    return seg || 'dashboard';
  });

  isAuthPage = computed(() => this.AUTH_ROUTES.has(this.activeView()));

  headerTitle = computed(() => {
    const item = APP_NAVIGATION_BY_ID.get(this.activeView());
    return this.i18n.t(item?.titleKey ?? 'app.title');
  });

  headerSub = computed(() => {
    const item = APP_NAVIGATION_BY_ID.get(this.activeView());
    return item ? this.i18n.t(item.subtitleKey) : '';
  });

  constructor() {
    this.update.init();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(this.routeLoadingTimer);
        this.routeLoadingTimer = setTimeout(() => this.routeLoading.set(true), 140);
        return;
      }

      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.finishNavigation(true);
        return;
      }

      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.finishNavigation(false);
      }
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.routeLoadingTimer));
  }

  private finishNavigation(resetViewport: boolean) {
    clearTimeout(this.routeLoadingTimer);
    this.routeLoading.set(false);
    if (!resetViewport) return;

    queueMicrotask(() => {
      const viewport = document.querySelector<HTMLElement>('.content__body');
      if (viewport) {
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
      }
      document.querySelector<HTMLElement>('.content__title-h')?.focus({ preventScroll: true });
    });
  }

  toggleSidebar() {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
  }

  nav(id: string) {
    this.router.navigate(['/' + id]);
  }

  navWithParams(event: { path: string; queryParams?: Record<string, string> }) {
    this.router.navigate(['/' + event.path], event.queryParams ? { queryParams: event.queryParams } : undefined);
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
      this.showCmdk.update((v) => !v);
    }
    if (e.key === 'Escape') {
      this.showCmdk.set(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      this.openNewMovement();
    }
  }
}
