import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LoggerService } from '../../shared/services/logger/logger.service';

export const httpLoggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const started = Date.now();

  logger.log(`HTTP ${req.method} ${req.url}`);

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const ms = Date.now() - started;
          logger.log(`HTTP ${req.method} ${req.url} → ${event.status} (${ms}ms)`);
        }
      },
      error: (err: HttpErrorResponse) => {
        const ms = Date.now() - started;
        const body = err.error ? (typeof err.error === 'string' ? err.error : JSON.stringify(err.error)) : '';
        logger.error(`HTTP ${req.method} ${req.url} FAILED ${err.status} (${ms}ms): ${err.message} ${body}`);
      },
    }),
  );
};
