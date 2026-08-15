import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated) return true;

  await auth.whenReady();
  return auth.isAuthenticated ? true : router.createUrlTree(['/login']);
};
