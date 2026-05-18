import { Component, computed, HostListener, signal, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { AuthService } from './shared/services/auth.service';
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
      { id: 'movimientos', key: 'nav.movimientos', icon: 'list', kbd: 'g m' },
      { id: 'calendario', key: 'nav.calendario', icon: 'calendar' },
    ],
  },
  {
    key: 'nav.cuentas',
    items: [
      { id: 'cuentas', key: 'nav.cuentas', icon: 'account', kbd: 'g a' },
      { id: 'tarjetas', key: 'nav.tarjetas', icon: 'card', kbd: 'g t' },
      { id: 'cuotas', key: 'nav.cuotas', icon: 'installments', dot: true, kbd: 'g c' },
      { id: 'prestamos', key: 'nav.prestamos', icon: 'loan' },
    ],
  },
  {
    key: 'nav.analisis',
    items: [
      { id: 'reportes', key: 'nav.reportes', icon: 'reports', kbd: 'g r' },
      { id: 'categorias', key: 'nav.categorias', icon: 'category', kbd: 'g k' },
    ],
  },
  { key: 'nav.app', items: [{ id: 'configuracion', key: 'nav.configuracion', icon: 'settings', kbd: 'g s' }] },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  template: `
    <div [class]="isAuthPage() ? '' : 'app-shell'">
      @if (!isAuthPage()) {
        <!-- TITLEBAR -->
        <div class="titlebar">
          @if (os.isMac) {
            <div class="titlebar__semaphore">
              <span class="titlebar__dot titlebar__dot--close">
                <svg viewBox="0 0 8 8">
                  <path d="M1 1l6 6M7 1L1 7" stroke="rgba(0,0,0,.5)" stroke-width="1.2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="titlebar__dot titlebar__dot--min">
                <svg viewBox="0 0 8 8">
                  <path d="M1 4h6" stroke="rgba(0,0,0,.5)" stroke-width="1.2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="titlebar__dot titlebar__dot--zoom">
                <svg viewBox="0 0 8 8">
                  <path d="M2 2v4h4M6 6L2 2" stroke="rgba(0,0,0,.5)" stroke-width="1.2" stroke-linecap="round" />
                </svg>
              </span>
            </div>
          }

          <div class="titlebar__title">
            <strong>{{ i18n.t('app.title') }}</strong>
            <span style="margin-left:10px;opacity:.6;font-size:11px"
              >{{ i18n.t('app.version') }} · {{ userName() }}</span
            >
          </div>

          <div class="titlebar__right">
            <button class="titlebar-btn" (click)="showCmdk = true">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M12 12l3 3" />
              </svg>
              {{ i18n.t('common.search') }}
              <span class="kbd">{{ os.kbd('K') }}</span>
            </button>
            <button class="titlebar-btn" (click)="theme.cycleTheme()" [attr.title]="i18n.t('common.change_theme')">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                @if (theme.isDarkTheme()) {
                  <path d="M12.5 9.5a5.5 5.5 0 0 1-5-5.5 5.5 5.5 0 0 0 5 5.5z" fill="currentColor" />
                } @else {
                  <circle cx="8" cy="8" r="3" />
                  <path
                    d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42"
                  />
                }
              </svg>
            </button>
          </div>
        </div>
      }

      @if (!isAuthPage()) {
        <!-- SIDEBAR -->
        <aside class="sidebar">
          <div class="sidebar__head">
            <span class="sidebar__brand-mark">f</span>
            <span class="sidebar__brand-name">{{ i18n.t('app.title') }}</span>
            <span class="sidebar__brand-ver">{{ i18n.t('app.version') }}</span>
          </div>

          <button class="sidebar__search" (click)="showCmdk = true">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M12 12l3 3" />
            </svg>
            <span>{{ i18n.t('common.search') }}</span>
            <span class="kbd">{{ os.kbd('K') }}</span>
          </button>

          <nav class="sidebar__scroll">
            @for (group of navGroups(); track group.label) {
              <div class="sidebar__group">{{ group.label }}</div>
              @for (item of group.items; track item.id) {
                <button class="nav-item" [class.nav-item--active]="activeView() === item.id" (click)="nav(item.id)">
                  <svg
                    class="nav-item__icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    [innerHTML]="iconSvg(item.icon)"
                  ></svg>
                  <span>{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="nav-item__badge">{{ item.badge }}</span>
                  }
                  @if (item.dot) {
                    <span class="nav-item__dot"></span>
                  }
                </button>
              }
            }
            @if (role.isAdmin()) {
              <div class="sidebar__group">{{ i18n.t('nav.admin') }}</div>
              <button class="nav-item" [class.nav-item--active]="activeView() === 'admin'" (click)="nav('admin')">
                <svg
                  class="nav-item__icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  [innerHTML]="iconSvg('admin')"
                ></svg>
                <span>{{ i18n.t('nav.admin') }}</span>
              </button>
            }
          </nav>

          <div class="sidebar__foot">
            <div class="sidebar__foot-avatar">{{ userInitials() }}</div>
            <div class="sidebar__foot-meta">
              <div class="sidebar__foot-name">{{ userName() }}</div>
              <div class="sidebar__foot-mail">{{ userEmail() }}</div>
            </div>
            <button
              class="btn btn--ghost btn--icon"
              (click)="nav('configuracion')"
              [attr.title]="i18n.t('nav.configuracion')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                [innerHTML]="iconSvg('settings')"
              ></svg>
            </button>
          </div>
        </aside>
      }

      <!-- CONTENT -->
      <main [class]="isAuthPage() ? '' : 'content'">
        @if (!isAuthPage()) {
          <header class="content__header">
            <div>
              <div class="eyebrow">{{ headerSub() }}</div>
              <h1 class="content__title-h" style="margin-top:2px">{{ headerTitle() }}</h1>
            </div>
            <div class="content__h-right">
              @if (activeView() !== 'configuracion') {
                <button class="btn btn--ghost">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  >
                    <path d="M1 4h14M4 8h8M7 12h2" />
                  </svg>
                  {{ i18n.t('common.filters') }}
                </button>
                <button class="btn btn--ghost">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  >
                    <path d="M8 1v10M4 7l4 4 4-4M2 13h12" />
                  </svg>
                  {{ i18n.t('common.export') }}
                </button>
                <button class="btn btn--primary" (click)="openNewMovement()">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                  >
                    <path d="M8 1v14M1 8h14" />
                  </svg>
                  {{ i18n.t('common.new_movement') }}
                </button>
              }
            </div>
          </header>
        }

        <div [class]="isAuthPage() ? '' : 'content__body'">
          <router-outlet />
        </div>
      </main>
    </div>

    @if (!isAuthPage()) {
      <!-- CMDK Palette -->
      @if (showCmdk) {
        <div class="overlay" (click)="showCmdk = false">
          <div class="cmdk" (click)="$event.stopPropagation()">
            <div class="cmdk__input-wrap">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M12 12l3 3" />
              </svg>
              <input
                class="cmdk__input"
                #cmdkInput
                [placeholder]="i18n.t('cmdk.placeholder')"
                [(ngModel)]="cmdkQuery"
                (input)="filterCmdk()"
                autofocus
              />
              <span class="kbd" style="cursor:pointer" (click)="showCmdk = false">ESC</span>
            </div>
            <div class="cmdk__list">
              <div class="cmdk__section">{{ i18n.t('cmdk.go_to') }}</div>
              @for (item of cmdkItems(); track item.id) {
                @if (matchesCmdk(item.label)) {
                  <div class="cmdk__item" (click)="cmdkNav(item.id)">
                    <span class="cmdk__item-lbl">{{ item.label }}</span>
                    @if (item.kbd) {
                      <span class="cmdk__item-kbd">{{ item.kbd }}</span>
                    }
                  </div>
                }
              }
              <div class="cmdk__section">{{ i18n.t('cmdk.actions') }}</div>
              <div class="cmdk__item" (click)="openNewMovement(); showCmdk = false">
                <span class="cmdk__item-lbl">{{ i18n.t('cmdk.new_movement') }}</span>
                <span class="cmdk__item-kbd">{{ os.kbd('N') }}</span>
              </div>
              <div class="cmdk__item" (click)="theme.cycleTheme(); showCmdk = false">
                <span class="cmdk__item-lbl">{{ i18n.t('cmdk.change_theme') }}</span>
                <span class="cmdk__item-kbd">{{ os.kbd(';') }}</span>
              </div>
              <div class="cmdk__item" (click)="auth.logout(); showCmdk = false">
                <span class="cmdk__item-lbl" style="color:var(--negative)">{{ i18n.t('common.sign_out') }}</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- New Movement Modal -->
      @if (showNewMovement) {
        <div class="overlay" (click)="showNewMovement = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal__h">
              <span class="modal__title">{{ i18n.t('common.new_movement') }}</span>
              <button class="btn btn--ghost btn--icon" (click)="showNewMovement = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path d="M1 1l14 14M15 1L1 15" />
                </svg>
              </button>
            </div>
            <div class="modal__body">
              <p class="eyebrow" style="margin-bottom:12px">{{ i18n.t('mov.go_to_movements') }}</p>
              <button class="btn btn--primary" style="width:100%" (click)="nav('movimientos'); showNewMovement = false">
                {{ i18n.t('nav.movimientos') }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class AppComponent {
  showCmdk = false;
  showNewMovement = false;
  cmdkQuery = '';

  public auth = inject(AuthService);
  public role = inject(RoleService);
  public theme = inject(ThemeService);
  public router = inject(Router);
  public os = inject(PlatformService);
  public i18n = inject(I18nService);
  private sanitizer = inject(DomSanitizer);

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

  isAuthPage = computed(() => {
    const v = this.activeView();
    return v === 'login' || v === 'register';
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

  headerTitle = computed(() => {
    const map: Record<string, TranslationKey> = {
      dashboard: 'header.dashboard',
      movimientos: 'header.movimientos',
      cuentas: 'header.cuentas',
      tarjetas: 'header.tarjetas',
      cuotas: 'header.cuotas',
      prestamos: 'header.prestamos',
      reportes: 'header.reportes',
      categorias: 'header.categorias',
      calendario: 'header.calendario',
      configuracion: 'header.configuracion',
      admin: 'header.admin',
    };
    return this.i18n.t(map[this.activeView()] ?? 'app.title');
  });

  headerSub = computed(() => {
    const map: Record<string, TranslationKey> = {
      dashboard: 'header_sub.dashboard',
      movimientos: 'header_sub.movimientos',
      cuentas: 'header_sub.cuentas',
      tarjetas: 'header_sub.tarjetas',
      cuotas: 'header_sub.cuotas',
      prestamos: 'header_sub.prestamos',
      reportes: 'header_sub.reportes',
      categorias: 'header_sub.categorias',
      calendario: 'header_sub.calendario',
      configuracion: 'header_sub.configuracion',
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

  nav(id: string) {
    this.router.navigate(['/' + id]);
  }

  cmdkNav(id: string) {
    this.nav(id);
    this.showCmdk = false;
    this.cmdkQuery = '';
  }

  filterCmdk() {}

  iconSvg(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[name] ?? '');
  }

  matchesCmdk(label: string): boolean {
    if (!this.cmdkQuery) return true;
    return label.toLowerCase().includes(this.cmdkQuery.toLowerCase());
  }

  openNewMovement() {
    this.router.navigate(['/movimientos']);
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
