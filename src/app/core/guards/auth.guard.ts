import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated) return true;
  // Esperar la reapertura local antes de decidir: dejar pasar por "hay un token
  // guardado" abría la vista sin perfil cargado y las consultas a SQLite fallaban.
  await auth.whenReady();
  return auth.isAuthenticated ? true : router.createUrlTree(['/login']);
};
