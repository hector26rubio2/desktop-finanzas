import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { provideAppConfig } from './core/config/app.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    ...provideAppConfig(),
  ],
};
