import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';

/**
 * La aplicación no tiene servidor. Los datos financieros viven en SQLite local y
 * la autenticación se resuelve contra el perfil local por IPC, así que ninguna
 * petición HTTP tiene destino legítimo.
 *
 * Este interceptor no filtra: bloquea todo. Sigue montado a propósito — es la
 * alarma que suena si alguien vuelve a introducir una llamada de red.
 */
export const localOnlyHttpGuardInterceptor: HttpInterceptorFn = (req) =>
  throwError(
    () =>
      new HttpErrorResponse({
        error: {
          code: 'local_only_http_blocked',
          detail: 'This application has no server: every HTTP request is blocked.',
        },
        status: 0,
        statusText: 'Blocked by local-only mode',
        url: req.urlWithParams,
      }),
  );
