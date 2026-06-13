import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/interceptors/auth/token.interceptor';
import { authRefreshInterceptor } from './core/interceptors/auth/refresh.interceptor';
import { encryptionInterceptor } from './core/interceptors/crypto/encryption.interceptor';
import { httpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { provideAppConfig } from './core/config/app.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([httpLoggingInterceptor, authTokenInterceptor, authRefreshInterceptor, encryptionInterceptor]),
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    ...provideAppConfig(),
  ],
};
