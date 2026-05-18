import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, AdminUserDto } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';
import { ThemeService } from '../shared/services/theme.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="layout">
      <header>
        <h2>{{ i18n.t('admin.title') }} — {{ i18n.t('admin.users') }}</h2>
        <div class="header-right">
          <button (click)="router.navigate(['/movimientos'])">← {{ i18n.t('common.back') }}</button>
          <button (click)="theme.cycleTheme()">{{ i18n.t('common.change_theme') }}</button>
          <button (click)="auth.logout()" class="danger">{{ i18n.t('common.sign_out') }}</button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading">{{ i18n.t('common.loading') }}</div>
      }

      @if (!loading()) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('admin.table_email') }}</th>
                <th>{{ i18n.t('admin.table_nombre') }}</th>
                <th>{{ i18n.t('admin.role') }}</th>
                <th>{{ i18n.t('admin.table_estado') }}</th>
                <th>{{ i18n.t('admin.table_creado') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u) {
                <tr>
                  <td>{{ u.email }}</td>
                  <td>{{ u.name }}</td>
                  <td>
                    <span class="badge" [class]="u.role.toLowerCase()">{{ u.role }}</span>
                  </td>
                  <td>
                    <span class="badge" [class]="u.isActive ? 'active' : 'inactive'">
                      {{ u.isActive ? i18n.t('admin.active') : i18n.t('admin.inactive') }}
                    </span>
                  </td>
                  <td class="muted">{{ u.createdAt | date: 'dd/MM/yy' }}</td>
                  <td class="actions">
                    <button
                      class="icon-btn"
                      (click)="toggleRole(u)"
                      [title]="u.role === 'Admin' ? i18n.t('admin.make_user') : i18n.t('admin.make_admin')"
                    >
                      {{ u.role === 'Admin' ? '👤' : '🔑' }}
                    </button>
                    <button
                      class="icon-btn"
                      (click)="toggleActive(u)"
                      [title]="u.isActive ? i18n.t('admin.deactivate') : i18n.t('admin.activate')"
                    >
                      {{ u.isActive ? '🚫' : '✅' }}
                    </button>
                  </td>
                </tr>
              }
              @if (users().length === 0) {
                <tr>
                  <td colspan="6" class="empty">{{ i18n.t('admin.sin_usuarios') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .muted {
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      .actions {
        display: flex;
        gap: 0.25rem;
      }
      td.actions {
        padding: 0.25rem 0.5rem;
      }
    `,
  ],
})
export class AdminComponent implements OnInit {
  users = signal<AdminUserDto[]>([]);
  loading = signal(true);

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private api = inject(ApiService);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAdminUsers().subscribe({
      next: (list) => {
        this.users.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleRole(u: AdminUserDto) {
    const role = u.role === 'Admin' ? 'User' : 'Admin';
    this.api.setUserRole(u.id, role).subscribe(() => this.load());
  }

  toggleActive(u: AdminUserDto) {
    this.api.setUserActive(u.id, !u.isActive).subscribe(() => this.load());
  }
}
