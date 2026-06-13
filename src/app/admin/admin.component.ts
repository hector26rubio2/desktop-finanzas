import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminUserDto } from '../shared/models/admin.model';
import { AdminApiService } from '../shared/services/api/admin-api.service';
import { AuthService } from '../shared/services/auth/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';
import { ThemeService } from '../shared/services/theme.service';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';

type UserTpl = TemplateRef<{ $implicit: AdminUserDto; row: AdminUserDto }>;

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  users = signal<AdminUserDto[]>([]);
  loading = signal(true);

  roleCell = viewChild<UserTpl>('roleCell');
  activeCell = viewChild<UserTpl>('activeCell');
  createdCell = viewChild<UserTpl>('createdCell');
  actionsCell = viewChild<UserTpl>('actionsCell');

  trackById = (u: AdminUserDto) => u.id;

  cols = computed<ColumnDef<AdminUserDto>[]>(() => [
    { key: 'email', header: this.i18n.t('admin.table_email') },
    { key: 'name', header: this.i18n.t('admin.table_nombre') },
    { key: 'role', header: this.i18n.t('admin.role'), cellTpl: this.roleCell() },
    { key: 'isActive', header: this.i18n.t('admin.table_estado'), cellTpl: this.activeCell() },
    { key: 'createdAt', header: this.i18n.t('admin.table_creado'), cellTpl: this.createdCell() },
    { key: 'id', header: '', cellTpl: this.actionsCell() },
  ]);

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private adminApi = inject(AdminApiService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.adminApi
      .getAdminUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.users.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  toggleRole(u: AdminUserDto) {
    const role = u.role === 'Admin' ? 'User' : 'Admin';
    this.adminApi
      .setUserRole(u.id, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  toggleActive(u: AdminUserDto) {
    this.adminApi
      .setUserActive(u.id, !u.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }
}
