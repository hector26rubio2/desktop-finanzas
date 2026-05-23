import { Component, computed, EventEmitter, inject, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService } from '../../shared/services/auth/auth.service';
import { RoleService } from '../../shared/services/role.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ICONS } from '../../shared/icons';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  host: { style: 'display: contents' },
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
})
export class UserMenuComponent {
  @Output() close = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<{ path: string; queryParams?: Record<string, string> }>();
  @Output() openCmdk = new EventEmitter<void>();

  public auth = inject(AuthService);
  public role = inject(RoleService);
  public i18n = inject(I18nService);
  private sanitizer = inject(DomSanitizer);

  userName = computed(() => this.auth.currentUser()?.name ?? 'Usuario');
  userEmail = computed(() => this.auth.currentUser()?.email ?? '');
  userInitials = computed(() => {
    const n = this.auth.currentUser()?.name ?? 'U';
    return n.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  });

  iconSvg(name: string): string {
    const svg = ICONS[name] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(svg) as unknown as string;
  }
}