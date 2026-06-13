import { InjectionToken, ValueProvider, inject } from '@angular/core';
import { environment } from '@env/environment';

export interface AppConfig {
  production: boolean;
  apiUrl: string;
  googleClientId: string;
  encryptionKey: string;
}

export const API_URL = new InjectionToken<string>('API_URL');
export const GOOGLE_CLIENT_ID = new InjectionToken<string>('GOOGLE_CLIENT_ID');
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export function provideAppConfig(): ValueProvider[] {
  return [
    { provide: APP_CONFIG, useValue: environment },
    { provide: API_URL, useValue: environment.apiUrl },
    { provide: GOOGLE_CLIENT_ID, useValue: environment.googleClientId },
  ];
}

export function injectApiUrl(): string {
  return inject(API_URL);
}
