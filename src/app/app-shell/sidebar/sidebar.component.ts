import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ICONS } from '../../shared/icons';
import { DomSanitizer } from '@angular/platform-browser';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  dot?: boolean;
  kbd?: string;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  collapsed = input(false);
  activeView = input('');
  userName = input('');
  userEmail = input('');
  userInitials = input('');
  isAdmin = input(false);
  showUserMenu = input(false);
  navGroups = input<SidebarGroup[]>([]);
  i18n = inject(I18nService);
  os = inject(PlatformService);
  nav = output<string>();
  toggleSidebar = output<void>();
  toggleUserMenu = output<void>();
  closeUserMenu = output<void>();
  logout = output<void>();
  changeTheme = output<void>();
  changeLanguage = output<void>();

  private sanitizer = inject(DomSanitizer);
  private iconCache = computed(() => {
    const cache: Record<string, string> = {};
    for (const [name, svg] of Object.entries(ICONS)) {
      cache[name] = this.sanitizer.bypassSecurityTrustHtml(svg) as unknown as string;
    }
    return cache;
  });

  iconSvg(name: string): string {
    return (this.iconCache() as Record<string, string>)[name] ?? ICONS[name] ?? '';
  }
}

import { PlatformService } from '../../shared/services/platform.service';
