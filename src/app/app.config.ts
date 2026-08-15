import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { routes } from './app.routes';
import { localOnlyHttpGuardInterceptor } from './core/interceptors/local-only-http-guard.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { provideAppConfig } from './core/config/app.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(routes),
    // No queda destino HTTP: los datos son locales y la autenticación va por IPC.
    // El guard se mantiene montado como alarma si alguien reintroduce una llamada.
    provideHttpClient(withXhr(), withInterceptors([localOnlyHttpGuardInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    ...provideAppConfig(),
  ],
};
