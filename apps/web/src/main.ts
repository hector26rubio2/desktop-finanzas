import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app';
import { routes } from './app/routes';
bootstrapApplication(AppComponent, { providers: [provideRouter(routes, withHashLocation())] }).catch(console.error);
