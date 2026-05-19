import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

export type AppRole = 'User' | 'Admin';
export type FeatureId =
  | 'dashboard'
  | 'movements'
  | 'calendar'
  | 'accounts'
  | 'cards'
  | 'installments'
  | 'loans'
  | 'reports'
  | 'categories'
  | 'settings'
  | 'admin';

const FEATURE_ROLES: Record<FeatureId, AppRole[]> = {
  dashboard: ['User', 'Admin'],
  movements: ['User', 'Admin'],
  calendar: ['User', 'Admin'],
  accounts: ['User', 'Admin'],
  cards: ['User', 'Admin'],
  installments: ['User', 'Admin'],
  loans: ['User', 'Admin'],
  reports: ['User', 'Admin'],
  categories: ['User', 'Admin'],
  settings: ['User', 'Admin'],
  admin: ['Admin'],
};

@Injectable({ providedIn: 'root' })
export class RoleService {
  private auth = inject(AuthService);
  readonly role = computed<AppRole>(() => (this.auth.currentUser()?.role as AppRole) ?? 'User');
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isUser = computed(() => this.role() === 'User');

  canAccess(feature: FeatureId): boolean {
    return FEATURE_ROLES[feature]?.includes(this.role()) ?? false;
  }

  canAccessSignal(feature: FeatureId) {
    return computed(() => FEATURE_ROLES[feature]?.includes(this.role()) ?? false);
  }
}
