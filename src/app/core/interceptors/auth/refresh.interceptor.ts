import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../../../shared/services/auth/auth.service';

let refreshing$: BehaviorSubject<boolean> | null = null;

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      if (!refreshing$) {
        refreshing$ = new BehaviorSubject<boolean>(true);
        return auth.refreshAccessToken().pipe(
          switchMap(() => {
            refreshing$!.next(false);
            refreshing$ = null;
            return next(req);
          }),
          catchError((_refreshErr) => {
            refreshing$ = null;
            auth.logout();
            return throwError(() => err);
          }),
        );
      }

      return refreshing$.pipe(
        filter((v) => !v),
        take(1),
        switchMap(() => next(req)),
      );
    }),
  );
};
