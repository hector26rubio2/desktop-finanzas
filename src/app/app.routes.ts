import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { adminGuard } from './shared/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'movimientos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/movimientos/movimientos.component').then((m) => m.MovimientosComponent),
  },
  {
    path: 'cuentas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cuentas/cuentas.component').then((m) => m.CuentasComponent),
  },
  {
    path: 'tarjetas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tarjetas/tarjetas.component').then((m) => m.TarjetasComponent),
  },
  {
    path: 'cuotas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cuotas/cuotas.component').then((m) => m.CuotasComponent),
  },
  {
    path: 'prestamos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/prestamos/prestamos.component').then((m) => m.PrestamosComponent),
  },
  {
    path: 'reportes',
    canActivate: [authGuard],
    loadComponent: () => import('./features/reportes/reportes.component').then((m) => m.ReportesComponent),
  },
  {
    path: 'categorias',
    canActivate: [authGuard],
    loadComponent: () => import('./features/categorias/categorias.component').then((m) => m.CategoriasComponent),
  },
  {
    path: 'calendario',
    canActivate: [authGuard],
    loadComponent: () => import('./features/calendario/calendario.component').then((m) => m.CalendarioComponent),
  },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
