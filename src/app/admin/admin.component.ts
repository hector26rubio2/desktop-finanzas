import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminUserDto } from '../shared/models/admin.model';
import { AdminApiService } from '../shared/services/api/admin-api.service';
import { AuthService } from '../shared/services/auth/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';
import { ThemeService } from '../shared/services/theme.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  users = signal<AdminUserDto[]>([]);
  loading = signal(true);

  public auth = inject(AuthService);
  public router = inject(Router);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);
  private adminApi = inject(AdminApiService);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.adminApi.getAdminUsers().subscribe({
      next: (list) => {
        this.users.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleRole(u: AdminUserDto) {
    const role = u.role === 'Admin' ? 'User' : 'Admin';
    this.adminApi.setUserRole(u.id, role).subscribe(() => this.load());
  }

  toggleActive(u: AdminUserDto) {
    this.adminApi.setUserActive(u.id, !u.isActive).subscribe(() => this.load());
  }
}
