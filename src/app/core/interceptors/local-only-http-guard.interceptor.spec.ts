import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { localOnlyHttpGuardInterceptor } from './local-only-http-guard.interceptor';

describe('localOnlyHttpGuardInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([localOnlyHttpGuardInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Sin API no queda ruta permitida. `/auth/*` está aquí a propósito: era la
  // única excepción que existía y ahora también debe fallar.
  it.each([
    'http://localhost:5063/auth/login',
    'https://api-finanzas-gjop.onrender.com/auth/refresh',
    'http://localhost:5063/financial/snapshot',
    'http://localhost:5063/sync/pull',
    'http://localhost:5063/admin/users',
    '/auth/login',
    '/assets/i18n/es.json',
    'https://example.com/auth/login',
    'https://accounts.google.com/gsi/client',
  ])('blocks %s before it reaches the HTTP backend', async (url) => {
    const result = firstValueFrom(http.get(url));

    await expect(result).rejects.toMatchObject<HttpErrorResponse>({
      status: 0,
      statusText: 'Blocked by local-only mode',
      error: { code: 'local_only_http_blocked' },
    });
    httpMock.expectNone(url);
  });

  it('blocks every verb, not only GET', async () => {
    for (const call of [http.post('/auth/login', {}), http.put('/auth/x', {}), http.delete('/auth/x')]) {
      await expect(firstValueFrom(call)).rejects.toMatchObject({ status: 0 });
    }
    httpMock.expectNone(() => true);
  });
});
