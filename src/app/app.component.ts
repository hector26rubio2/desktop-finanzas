import { Component, computed, HostListener, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './shared/services/auth/auth.service';
import { I18nService } from './shared/i18n/i18n.service';
import type { TranslationKey } from './shared/i18n/locale.types';
import { SidebarComponent } from './shell/sidebar/sidebar.component';
import { ShellHeaderComponent } from './shell/header/header.component';
import { CmdkComponent } from './shell/cmdk/cmdk.component';
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

  public auth = inject(AuthService);
  public router = inject(Router);
  public i18n = inject(I18nService);
  public update = inject(UpdateService);
  public notif = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  private currentUrl = signal(this.router.url || '/login');
  private AUTH_ROUTES = new Set(['login', 'register', 'forgot-password', 'reset-password', 'verify-email']);

  activeView = computed(() => {
    const seg = this.currentUrl().split('/')[1]?.split('?')[0] ?? '';
    return seg || 'dashboard';
  });

  isAuthPage = computed(() => this.AUTH_ROUTES.has(this.activeView()));

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

  constructor() {
    this.update.init();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
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
