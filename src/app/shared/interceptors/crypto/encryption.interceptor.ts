import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { encrypt, decrypt } from '../../utils/crypto';

export const encryptionInterceptor: HttpInterceptorFn = (req, next) => {
  const body = req.body;
  const skip = body instanceof FormData || req.method === 'GET';

  if (body && typeof body === 'object' && !skip) {
    return from(encrypt(body)).pipe(
      switchMap((encrypted) => next(req.clone({ body: { encrypted } }))),
      switchMap(async (event) => {
        if (event instanceof HttpResponse) {
          const b = event.body as Record<string, unknown> | null;
          if (b && typeof b === 'object' && b['encrypted']) {
            return event.clone({ body: await decrypt(b['encrypted'] as string) });
          }
        }
        return event;
      }),
    );
  }

  return next(req).pipe(
    switchMap(async (event) => {
      if (event instanceof HttpResponse) {
        const b = event.body as Record<string, unknown> | null;
        if (b && typeof b === 'object' && b['encrypted'] && !skip) {
          return event.clone({ body: await decrypt(b['encrypted'] as string) });
        }
      }
      return event;
    }),
  );
};
