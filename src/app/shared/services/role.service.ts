import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

export type AppRole = 'User' | 'Admin';
export type FeatureId =
  | 'dashboard'
  | 'movimientos'
  | 'calendario'
  | 'cuentas'
  | 'tarjetas'
  | 'cuotas'
  | 'prestamos'
  | 'reportes'
  | 'categorias'
  | 'configuracion'
  | 'admin';

const FEATURE_ROLES: Record<FeatureId, AppRole[]> = {
  dashboard: ['User', 'Admin'],
  movimientos: ['User', 'Admin'],
  calendario: ['User', 'Admin'],
  cuentas: ['User', 'Admin'],
  tarjetas: ['User', 'Admin'],
  cuotas: ['User', 'Admin'],
  prestamos: ['User', 'Admin'],
  reportes: ['User', 'Admin'],
  categorias: ['User', 'Admin'],
  configuracion: ['User', 'Admin'],
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
