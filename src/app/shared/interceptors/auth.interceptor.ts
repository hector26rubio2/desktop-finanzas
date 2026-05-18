import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const addToken = (token: string) => req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  const authedReq = auth.accessToken ? addToken(auth.accessToken) : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/auth/')) {
        const refresh$ = auth.refreshAccessToken();
        if (refresh$) {
          return refresh$.pipe(
            switchMap((r) => next(addToken(r.accessToken))),
            catchError(() => {
              router.navigate(['/login']);
              return throwError(() => err);
            }),
          );
        }
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
