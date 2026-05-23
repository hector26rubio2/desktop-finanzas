import { Routes } from '@angular/router';
import { authGuard } from '@shared/guards/auth.guard';
import { adminGuard } from '@shared/guards/admin.guard';

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
    path: 'verify-email',
    loadComponent: () => import('@auth/verify-email').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('@auth/forgot-password').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('@auth/reset-password').then((m) => m.ResetPasswordComponent),
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
    path: 'cards',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cards/cards.component').then((m) => m.CardsComponent),
  },
  {
    path: 'installments',
    canActivate: [authGuard],
    loadComponent: () => import('./features/installments/installments.component').then((m) => m.InstallmentsComponent),
  },
  {
    path: 'loans',
    canActivate: [authGuard],
    loadComponent: () => import('./features/loans/loans.component').then((m) => m.LoansComponent),
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
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
