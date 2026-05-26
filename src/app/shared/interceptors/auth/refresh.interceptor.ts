import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';

let refreshing$: BehaviorSubject<boolean> | null = null;

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      const doRefresh = () => {
        const refresh$ = auth.refreshAccessToken();
        return refresh$.pipe(
          switchMap(() => next(req)),
          catchError(() => {
            auth.logout();
            return throwError(() => err);
          }),
        );
      };

      if (!refreshing$) {
        refreshing$ = new BehaviorSubject<boolean>(true);
        const result$ = doRefresh();
        result$.subscribe({
          complete: () => {
            refreshing$?.next(false);
            refreshing$ = null;
          },
          error: () => {
            refreshing$ = null;
          },
        });
        return result$;
      }

      return refreshing$.pipe(
        filter((v) => !v),
        take(1),
        switchMap(() => doRefresh()),
      );
    }),
  );
};
