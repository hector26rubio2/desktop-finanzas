import { InjectionToken, ValueProvider } from '@angular/core';
import { environment } from '@env/environment';

export interface AppConfig {
  production: boolean;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export function provideAppConfig(): ValueProvider[] {
  return [{ provide: APP_CONFIG, useValue: environment }];
}
