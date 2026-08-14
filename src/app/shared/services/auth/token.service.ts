import { Injectable, signal } from '@angular/core';
import type { UserInfo } from '../../models/auth.model';

/**
 * Identidad de la sesión abierta. Ya no hay token de acceso: la autenticación es
 * local y la sesión real vive en el proceso main. Aquí solo se guarda quién es
 * el usuario, porque `ownerId` es lo que filtra cada consulta a SQLite.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  readonly currentUser = signal<UserInfo | null>(null);

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  set(user: UserInfo): void {
    // La preferencia local manda sobre la del perfil: es la que el usuario
    // cambió por última vez desde Ajustes.
    const pref = localStorage.getItem('pref-base-currency');
    this.currentUser.set(pref ? { ...user, baseCurrency: pref } : user);
  }

  updateBaseCurrency(code: string): void {
    localStorage.setItem('pref-base-currency', code);
    const u = this.currentUser();
    if (u) this.currentUser.set({ ...u, baseCurrency: code });
  }

  clear(): void {
    this.currentUser.set(null);
  }
}
