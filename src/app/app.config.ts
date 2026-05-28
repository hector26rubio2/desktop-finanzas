import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authTokenInterceptor } from './shared/interceptors/auth/token.interceptor';
import { authRefreshInterceptor } from './shared/interceptors/auth/refresh.interceptor';
import { encryptionInterceptor } from './shared/interceptors/crypto/encryption.interceptor';
import { csrfInterceptor } from './shared/interceptors/csrf.interceptor';
import { httpLoggingInterceptor } from './shared/services/logger/http-logging.interceptor';
import { GlobalErrorHandler } from './shared/services/logger/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        httpLoggingInterceptor,
        csrfInterceptor,
        authTokenInterceptor,
        authRefreshInterceptor,
        encryptionInterceptor,
      ]),
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
