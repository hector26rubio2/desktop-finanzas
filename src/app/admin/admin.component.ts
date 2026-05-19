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

