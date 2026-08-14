import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('@auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('@auth/register').then((m) => m.RegisterComponent),
  },
  {
    // Sin servidor no hay correo de verificación ni enlace de restablecimiento:
    // la única vuelta atrás es el código emitido al crear el perfil.
    path: 'recover',
    loadComponent: () => import('@auth/recover').then((m) => m.RecoverComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'movements',
    canActivate: [authGuard],
    loadComponent: () => import('./features/movements/movements.component').then((m) => m.MovementsComponent),
  },
  {
    path: 'accounts',
    canActivate: [authGuard],
    loadComponent: () => import('./features/accounts/accounts.component').then((m) => m.AccountsComponent),
  },
  {
    path: 'portfolio',
    canActivate: [authGuard],
    loadComponent: () => import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
  },
  {
    path: 'platform-tools',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/platform-tools/platform-tools.component').then((m) => m.PlatformToolsComponent),
  },
  {
    path: 'cards',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cards/cards.component').then((m) => m.CardsComponent),
  },
  {
    path: 'loans',
    canActivate: [authGuard],
    loadComponent: () => import('./features/loans/loans.component').then((m) => m.LoansComponent),
  },
  {
    path: 'recurring',
    canActivate: [authGuard],
    loadComponent: () => import('./features/recurring/recurring.component').then((m) => m.RecurringComponent),
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'categories',
    canActivate: [authGuard],
    loadComponent: () => import('./features/categories/categories.component').then((m) => m.CategoriesComponent),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
