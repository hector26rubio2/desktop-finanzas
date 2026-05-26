import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth/auth.service';
import { RoleService } from '../../shared/services/role.service';
import { ThemeService } from '../../shared/services/theme.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { TranslationKey } from '../../shared/i18n/locale.types';

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
      { id: 'movements', key: 'nav.movements', icon: 'list', kbd: 'g m' },
      { id: 'calendar', key: 'nav.calendar', icon: 'calendar' },
    ],
  },
  {
    key: 'nav.accounts',
    items: [
      { id: 'accounts', key: 'nav.accounts', icon: 'account', kbd: 'g a' },
      { id: 'cards', key: 'nav.cards', icon: 'card', kbd: 'g t' },
      { id: 'installments', key: 'nav.installments', icon: 'installments', dot: true, kbd: 'g c' },
      { id: 'loans', key: 'nav.loans', icon: 'loan' },
    ],
  },
  {
    key: 'nav.analisis',
    items: [
      { id: 'reports', key: 'nav.reports', icon: 'reports', kbd: 'g r' },
      { id: 'categories', key: 'nav.categories', icon: 'category', kbd: 'g k' },
    ],
  },
  { key: 'nav.app', items: [{ id: 'settings', key: 'nav.settings', icon: 'settings', kbd: 'g s' }] },
];

@Component({
  selector: 'app-cmdk',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmdk.component.html',
  styleUrl: './cmdk.component.css',
})
export class CmdkComponent {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<string>();
  @Output() newMovement = new EventEmitter<void>();

  query = signal('');

  public auth = inject(AuthService);
  public role = inject(RoleService);
  public theme = inject(ThemeService);
  public i18n = inject(I18nService);

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

  matches(label: string): boolean {
    if (!this.query()) return true;
    return label.toLowerCase().includes(this.query().toLowerCase());
  }

  onNavigate(id: string) {
    this.navigate.emit(id);
    this.close.emit();
    this.query.set('');
  }

  onNewMovement() {
    this.newMovement.emit();
    this.close.emit();
    this.query.set('');
  }

  onTheme() {
    this.theme.cycleTheme();
    this.close.emit();
  }

  onLogout() {
    this.auth.logout();
    this.close.emit();
  }
}
