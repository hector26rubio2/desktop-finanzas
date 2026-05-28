import { HttpInterceptorFn, HttpResponse, HttpEvent } from '@angular/common/http';
import { from, Observable, of, switchMap, catchError } from 'rxjs';
import { encrypt, decrypt } from '../../utils/crypto';

function tryDecrypt(event: HttpEvent<unknown>): Observable<HttpEvent<unknown>> {
  if (event instanceof HttpResponse) {
    const b = event.body as Record<string, unknown> | null;
    if (b && typeof b === 'object' && b['encrypted']) {
      return from(
        decrypt(b['encrypted'] as string).then<HttpEvent<unknown>>((decrypted: unknown) =>
          event.clone({ body: decrypted }),
        ),
      ).pipe(
        catchError(() => {
          console.warn('Decryption failed; passing response through unmodified.');
          return of(event);
        }),
      );
    }
  }
  return of(event);
}

export const encryptionInterceptor: HttpInterceptorFn = (req, next) => {
  const body = req.body;
  const skipEncrypt = body instanceof FormData || req.method === 'GET';

  if (body && typeof body === 'object' && !skipEncrypt) {
    return from(encrypt(body)).pipe(
      switchMap((encrypted: string) => next(req.clone({ body: { encrypted } }))),
      catchError((err) => {
        throw err;
      }),
      switchMap((event: HttpEvent<unknown>) => tryDecrypt(event)),
    );
  }

  return next(req).pipe(switchMap((event: HttpEvent<unknown>) => tryDecrypt(event)));
};
