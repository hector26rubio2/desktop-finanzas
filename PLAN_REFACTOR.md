# Plan de Refactorización y Optimización — 7 Fases

## Inventario completo de componentes/vistas

### SHELL (Layout global)
| Componente | Archivos | Estado actual |
|---|---|---|
| `app-root` | `app.component.ts/html/css` | ✅ Layout base |
| `app-sidebar` | `shell/sidebar/` | ✅ Navegación |
| `app-shell-header` | `shell/header/` | ✅ Header |
| `app-user-menu` | `shell/user-menu/` | ✅ Menú usuario |
| `app-cmdk` | `shell/cmdk/` | ✅ Command palette |

### AUTH (Autenticación)
| Componente | Archivos |
|---|---|
| `LoginComponent` | `auth/login/` |
| `RegisterComponent` | `auth/register/` |
| `ForgotPasswordComponent` | `auth/forgot-password/` |
| `ResetPasswordComponent` | `auth/reset-password/` |
| `VerifyEmailComponent` | `auth/verify-email/` |

### FEATURES (10 módulos)
| Componente | Archivos |
|---|---|
| `DashboardComponent` | `features/dashboard/` |
| `MovementsComponent` | `features/movements/` |
| `AccountsComponent` | `features/accounts/` |
| `CardsComponent` | `features/cards/` |
| `InstallmentsComponent` | `features/installments/` |
| `LoansComponent` | `features/loans/` |
| `ReportsComponent` | `features/reports/` |
| `CategoriesComponent` | `features/categories/` |
| `CalendarComponent` | `features/calendar/` |
| `SettingsComponent` | `features/settings/` |

### ADMIN
| Componente | Archivos |
|---|---|
| `AdminComponent` | `admin/` |

### SHARED UI (17 componentes)
| Componente | Uso principal |
|---|---|
| `ButtonComponent` | Botones reutilizables |
| `InputComponent` | Input fields |
| `SelectComponent` | Select dropdowns |
| `ModalComponent` | Modales/diálogos |
| `CardComponent` | Cards genéricas |
| `KpiCardComponent` | KPIs del dashboard |
| `KpiStripComponent` | Banda de KPIs |
| `DataTableComponent` | Tablas con paginación |
| `PaginationComponent` | Paginador |
| `ConfirmDialogComponent` | Confirmaciones |
| `EmptyStateComponent` | Estados vacíos |
| `LoaderComponent` | Loaders |
| `CatIconComponent` | Iconos |
| `IconPickerComponent` | Selector de iconos |
| `DatePickerComponent` | Date picker |
| `GranularitySelectorComponent` | Selector día/mes/año |
| `PeriodNavComponent` | Navegación períodos |
| `LineChartComponent` | Gráfico de líneas |
| `PieChartComponent` | Gráfico de torta |
| `RecentMovementsComponent` | Movimientos recientes |
| `MovementDetailModalComponent` | Detalle movimiento |
| `UpdateBannerComponent` | Banner de actualización |

### SERVICIOS (12+)
- `ApiService` (facade → 7 sub-apis)
- `DashboardService`
- `AuthService`, `SessionService`, `TokenService`
- `I18nService`
- `ThemeService`
- `RoleService`
- `PlatformService`
- `LoggerService`
- `UpdateService`

---

## FASE 1: DISEÑO (Design — UI/UX)

### Problemas detectados
| # | Componente | Problema | Acción |
|---|---|---|---|
| D1 | **Dashboard** — KPI cards | Textos se cortan, tamaños inconsistentes | ✅ Corregido (grid responsive, overflow-wrap) |
| D2 | **Dashboard** — KPI cards | Demasiado borde (border-left 3px + bottom bar) | ✅ Corregido (eliminados bordes/bar) |
| D3 | **Movements** | Faltan estados vacíos consistentes | Agregar `app-empty-state` |
| D4 | **Accounts** | Formulario modal sin diseño responsivo | Revisar padding en mobile |
| D5 | **Categories** | Formulario de traducciones muy denso | Mejorar espaciado |
| D6 | **Settings** | Sección de configuración sin agrupación visual | Agregar cards por sección |
| D7 | **Calendar** | Grid de calendario no tiene hover states en eventos | Agregar feedback visual |
| D8 | **Cards** | Sidebar de resumen de pago no es sticky en scroll | Verificar position sticky |
| D9 | **Installments** | Tabla genérica sin diseño de cuotas | Mejorar visual de progreso |
| D10 | **Reports** | KPIs sin gráfico de barras de cashflow | Unificar diseño con dashboard |
| D11 | **Login/Register** | Formularios centrados pero sin branding visual | Agregar logo/marca |
| D12 | **Admin** | Tabla de usuarios sin diseño de roles | Mejorar badges de roles |

### Acciones correctivas
- Unificar espaciado vertical entre componentes (`var(--gutter)`)
- Agregar transiciones suaves en hover de cards
- Consistencia en radios de borde (`var(--radius-card)`)
- Estados vacíos con ilustraciones/iconos
- Skeleton loading en todas las listas

---

## FASE 2: ESTILOS (Styles — CSS Architecture)

### Problemas detectados
| # | Componente | Problema | Acción |
|---|---|---|---|
| S1 | **Global styles.css** | 2458 líneas — monolithic, sin organización por sección | Dividir en partials CSS |
| S2 | **Global** | Duplicación de estilos entre global y dashboard.component.css (`.kpi-card`) | ✅ Parcialmente corregido, seguir limpiando |
| S3 | **Components** | Uso inconsistente de `var(--line)` vs `var(--line-1)` vs `var(--line-2)` | Unificar variables de borde |
| S4 | **Sidebar** | sidebar.component.css está vacío (0 líneas) — estilos inline en template? | Mover a CSS o verificar si usa globales |
| S5 | **Tailwind** | Tailwind instalado pero NO se usa en ningún componente | Decidir: eliminar Tailwind o migrar |
| S6 | **Auth** | `auth-shared.css` compartido pero importado manualmente | Crear un mixin/layout compartido |
| S7 | **Inline styles** | Múltiples templates usan `style="..."` en lugar de clases | Migrar a clases CSS |
| S8 | **Variables** | Faltan variables para spacing (gap, padding) consistente | Definir `--space-xs`, `--space-sm`, etc. |

### Inline styles detectados (ejemplos)
- `dashboard.component.html` — `style="flex: 1"`, `style="margin-top: 8px"`, etc.
- `cards.component.html` — múltiples `style="..."` en celdas de tabla
- `calendar.component.html` — `style="padding: 0; overflow: hidden"`, etc.
- `accounts.component.html` — `style="flex: 1"`, `style="margin-top: 16px"`

### Acciones correctivas
- Extraer estilos inline a clases CSS con nombres semánticos
- Definir sistema de spacing tokens (`--space-1`: 4px, `--space-2`: 8px, etc.)
- Eliminar Tailwind si no se usa (o empezar a usarlo)
- Dividir `styles.css` en partials: `_theme.css`, `_layout.css`, `_components.css`, `_utilities.css`
- Unificar variables de border en `--border`, `--border-strong`, `--border-subtle`

---

## FASE 3: MAQUETACIÓN (Markup — HTML Structure)

### Problemas detectados
| # | Componente | Problema | Acción |
|---|---|---|---|
| M1 | **app.component.html** | Class condicional con operador ternario anidado | Usar `computed()` o `host` binding |
| M2 | **Sidebar** | SVG icons con `[innerHTML]` sanitizado — lento en re-renders | Cachear en signal y evitar bypass |
| M3 | **Dashboard** | Chart.js se renderiza con `setTimeout` en effect | Usar `afterNextRender` |
| M4 | **Movements** | Import de `Parser` (csv/json parser) duplicado | Revisar dependencias no usadas |
| M5 | **Cards** | Track horizontal de cards con scroll — sin indicador visual de scroll | Agregar fade en bordes |
| M6 | **Todos los modales** | El modal usa `effect` para focus trap — debería ser `afterNextRender` | Corregir |
| M7 | **Forms** | Múltiples forms con `form.get('field')?.invalid && form.get('field')?.touched` | Crear helper/componente `field-error` |
| M8 | **Responsive** | Layout de 2 columnas en charts no tiene breakpoint (solo 900px) | Agregar breakpoints tablet/mobile |

### Acciones correctivas
- Reemplazar `effect` con `afterNextRender` para DOM manipulations
- Centralizar lógica de field-errors en componente reutilizable
- Agregar `<meta viewport>` y breakpoints para tablets (768px) y mobile (480px)
- Sidebar colapsable responsive (drawer en mobile)
- Indicadores de scroll horizontal en cards y tablas

---

## FASE 4: SEMÁNTICA (Semantics — HTML & Accessibility)

### Problemas detectados
| # | Componente | Problema | Acción |
|---|---|---|---|
| A1 | **DataTable** | Usa `<div class="table">` en lugar de `<table>` real | ✅ Ya usa `<table>` — bien |
| A2 | **Cards (tarjetas)** | Cards clickeables sin `role="button"` ni `tabindex` | Agregar ARIA |
| A3 | **Sidebar** | Navegación con `<nav>` y `aria-label` — ✅ correcto | Mantener |
| A4 | **Dashboard** | Gráficos canvas sin `role="img"` ni `aria-label` | Agregar descripción |
| A5 | **KPIs** | Valores numéricos sin formato accesible | Usar `<span aria-label="...">` |
| A6 | **Modal** | Focus trap y `aria-modal` — ✅ correcto | Mantener |
| A7 | **Forms** | Labels asociados a inputs — usar `<label for>` consistency | Revisar |
| A8 | **Iconos** | SVG decorativos con `aria-hidden="true"` — ✅ correcto | Mantener |
| A9 | **Empty states** | Sin `role="status"` consistente | Agregar a todos |
| A10 | **Color** | Contraste de colores en modo light/dark | Verificar ratio WCAG 4.5:1 |
| A11 | **Keyboard** | Tablas con `rowClickable` tienen `tabindex=0` — ✅ correcto | Expandir a todas las listas |
| A12 | **Notifications** | Mensajes de éxito/error sin `role="alert"` | Agregar live regions |

### Acciones correctivas
- Auditoría de contraste WCAG 2.1 AA en ambos temas
- Agregar `role="img"` + `aria-label` en gráficos Chart.js
- Reemplazar `<div>` con `<section>`, `<header>`, `<footer>` donde aplique
- Agregar `aria-live="polite"` en áreas de contenido dinámico
- Skip-to-content link para navegación por teclado

---

## FASE 5: OPTIMIZACIÓN DEL CÓDIGO (Code Optimization)

### Problemas detectados
| # | Componente | Problema | Acción |
|---|---|---|---|
| O1 | **ApiService** | Facade con delegación manual — bien pero crece | Evaluar si realmente necesario vs inyectar sub-apis directo |
| O2 | **DashboardService** | 469 líneas en dashboard.component.ts — demasiada lógica | Extraer lógica de charts a servicio/hooks |
| O3 | **Movements** | forkJoin en componente — debería estar en servicio | Mover a servicio |
| O4 | **Auth** | `auth.service.ts` mezcla auth + sesión + usuario | Separar responsabilidades |
| O5 | **Icons** | `ICONS` object con SVGs inline grandes (iconos de Lucide) | Cargar lazy o tree-shake |
| O6 | **CatIcons** | `cat-icons.ts` con 50+ iconos inline | Evaluar si usar spritesheet |
| O7 | **Chart.js** | Import global `Chart.register(...registerables)` — importa TODO | Importar solo lo necesario |
| O8 | **Pipes** | `FmtDatePipe` se usa en templates — es impuro? | Verificar pureza |
| O9 | **DestroyRef** | Movements usa `takeUntilDestroyed` — ✅ moderno | Expandir a demás componentes |
| O10 | **Bundle** | Angular Material instalado pero parece no usarse | Verificar dependencias muertas |
| O11 | **RxJS** | Algunos subscribe sin pipe(first()) pueden causar memory leaks | Usar `takeUntilDestroyed` |
| O12 | **Reactivity** | Componentes que usan `computed` + `effect` para efectos secundarios | Evaluar signals vs observables |

### Acciones correctivas
- Tree-shake Chart.js: importar solo `registerables` necesarios
- Extraer lógica pesada de componentes a servicios DDD
- Reemplazar `ICONS` object con carga lazy o sprites
- Eliminar Angular Material si no se usa (bundle saving ~300KB)
- Agregar `takeUntilDestroyed` en todos los subscribe
- Lazy load imágenes y componentes pesados

---

## FASE 6: PRINCIPIOS SOLID (SOLID Principles)

### Single Responsibility (S)
| # | Violación | Solución |
|---|---|---|
| SR1 | `dashboard.component.ts` (469 líneas) — charts + navegación + date picker + data table | Extraer date picker, chart renderers a servicios/hooks |
| SR2 | `ApiService` — facade de 7 apis + re-export de types | Mantener facade pero mover types a barrel |
| SR3 | `AuthService` — autenticación + sesión + perfil usuario | Separar en `AuthService`, `SessionService` ✅ ya existen! |
| SR4 | `SidebarComponent` — navegación + menú usuario + avatar | Ya está bien separado con `UserMenuComponent` |

### Open/Closed (O)
| # | Violación | Solución |
|---|---|---|
| OC1 | ColumnDef `key: keyof T & string` — no permite columnas computadas | Agregar `computedKey` opcional |
| OC2 | DataTable — extender con slot para toolbar/filtros | Agregar `ng-content` con select |
| OC3 | KpiCard — inputs planos, no extensible | Usar content projection para variantes |

### Liskov Substitution (L)
| # | Violación | Solución |
|---|---|---|
| L1 | `DataTableComponent<T>` genérico — bien implementado | ✅ Mantener |
| L2 | Modelos de API con `any` en algunos campos | Tipar correctamente |

### Interface Segregation (I)
| # | Violación | Solución |
|---|---|---|
| IS1 | `AccountRequest` mezcla campos de Cash/Debit/Credit | Interfaces segregadas por tipo |
| IS2 | `MovementRequest` mezcla loan + installment + normal | Split por tipo de movimiento |

### Dependency Inversion (D)
| # | Violación | Solución |
|---|---|---|
| DI1 | Componentes inyectan `ApiService` directo (concreto) | Buena abstracción pero evaluar inyectar sub-apis |
| DI2 | `DashboardService` depende de `ApiService` concreto | Ya inyecta ApiService — bien |
| DI3 | Logger es interfaz (`LoggerService`) — ✅ correcto | Mantener |

---

## FASE 7: PATRONES (Design Patterns & Architecture)

### Patrones actuales detectados
| Patrón | Dónde se usa | Estado |
|---|---|---|
| **Facade** | `ApiService` → 7 sub-apis | ✅ Bien |
| **Smart/Dumb** | Dashboard (smart) + KpiCard (dumb) | ✅ En progreso |
| **Repository** | API services encapsulan HTTP | ✅ |
| **Signals-first** | Todos los componentes | ✅ Moderno |
| **Content Projection** | Modal, Card, DataTable | ✅ |
| **Template Ref** | DataTable cell templates | ✅ |

### Patrones a implementar/mejorar
| # | Patrón | Dónde | Acción |
|---|---|---|---|
| P1 | **Composable** | Filtros + toolbar en features | Crear componentes `view-toolbar`, `view-filters` |
| P2 | **State Service** | DashboardService ya es state service | ✅ Buen ejemplo, replicar en demás features |
| P3 | **Command Pattern** | Operaciones CRUD con undo? | Evaluar si necesario |
| P4 | **Adapter** | Diferentes fuentes de datos (API local, remoto) | Preparar abstracción |
| P5 | **Strategy** | Granularidad (day/week/month/year) ya implementado | ✅ Mantener |
| P6 | **Observer** | RxJS para streams HTTP | ✅ Bien |
| P7 | **Factory** | Creación de formularios con diferentes configuraciones | Evaluar |
| P8 | **Config Provider** | Variables de entorno y configuración global | Centralizar en app.config |
| P9 | **Interceptor chain** | 4 interceptors HTTP ya implementados | ✅ Bien |
| P10 | **Strict Standalone** | Todos los componentes standalone | ✅ OK |
| P11 | **Feature-first** | Organización por features vs layers | ✅ features/ por módulo |
| P12 | **Lazy routes** | Todas las rutas con loadComponent | ✅ Óptimo |

### Arquitectura actual (implementada)
```
src/
├── app/
│   ├── core/                    ← Singleton services, guards, interceptors ✅
│   │   ├── guards/              (auth.guard, admin.guard)
│   │   ├── interceptors/        (token, refresh, encryption, http-logging)
│   │   ├── errors/              (global-error-handler)
│   │   └── index.ts             (barrel)
│   ├── features/                (10 módulos)
│   ├── shared/
│   │   ├── ui/
│   │   │   ├── atoms/           (6: button, input, select, loader, cat-icon, icon-picker)
│   │   │   ├── molecules/       (9: card, kpi-card, kpi-strip, pagination, empty-state, confirm-dialog, granularity-selector, period-nav, date-picker)
│   │   │   ├── organisms/       (7: data-table, modal, movement-detail-modal, recent-movements, line-chart, pie-chart, update-banner)
│   │   │   └── index.ts         (barrel unificado)
│   │   ├── pipes/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── i18n/
│   │   └── services/
│   │       ├── api/             (7 sub-apis)
│   │       ├── auth/            (auth, session, token)
│   │       └── logger/          (logger.service)
│   ├── shell/                   (sidebar, header, cmdk)
│   ├── auth/                    (login, register, etc)
│   └── admin/
```

---

## Priorización por impacto

| Prioridad | Fase | Componentes | Esfuerzo | Impacto |
|---|---|---|---|---|
| 🔴 **P0** | F5 Optimización | Chart.js tree-shake, Material eliminar, memory leaks | 2-3d | Alto (bundle) |
| 🔴 **P0** | F1 Diseño | KPI responsive, estados vacíos, skeletons | 3-4d | Alto (UX) |
| 🟡 **P1** | F2 Estilos | Inline styles → CSS, variables consistency | 4-5d | Medio (mantenibilidad) |
| 🟡 **P1** | F4 Semántica | WCAG audit, ARIA, keyboard nav | 3-4d | Alto (accesibilidad) |
| 🟢 **P2** | F3 Maquetación | Responsive breakpoints, field-error component | 3-4d | Medio (UX) |
| 🟢 **P2** | F6 SOLID | Extraer DashboardService, segregar interfaces | 5-6d | Medio (arquitectura) |
| 🔵 **P3** | F7 Patrones | ViewToolbar, ViewFilters composables | 4-5d | Bajo (futuro) |

---

## Próximos pasos

1. **Fase 1 (Diseño)**: ✅ Completa
2. **Fase 2 (Arquitectura DDD)**: ✅ Completa
3. **Fase 5 (Optimización)**: ✅ Completa — Angular Material eliminado (~300KB), Chart.js tree-shake (solo `line`/`doughnut`), `takeUntilDestroyed` en 34 subscribes (14 archivos), `core/chart.setup.ts` con imports individuales
4. **Fase 4 (Semántica/Accesibilidad)**: ✅ Completa — `role="button"` en filas clickeables (DataTable, cc-card, loans, sidebar), `role="img"` + `aria-label` en 4 canvas, `role="group"` + `aria-label` en KPI cards, `role="status"` en empty states, `sr-only` class, `NotificationService` + `aria-live` region en app-root
5. **Fase 3 (Maquetación)**: ✅ Completa — `afterNextRender` en dashboard/pie-chart/line-chart (reemplaza `setTimeout`), `NgZone.runOutsideAngular` removido (afterNextRender ya corre fuera de zona), `field-error` component creado en `shared/ui/atoms/`, cards scroll fade gradient indicator
6. **Fase 6 (SOLID)**: ✅ Parcial — SR1 (chart extraction) diferido: los componentes reutilizables `LineChartComponent`/`PieChartComponent` ya existen pero dashboard no los usa; OC1 (computedKey) no necesario porque `cellTpl` cubre; IS1/IS2 (interface segregation) requiere cambios en API layer — postergado para cuando se toquen esos features
7. **Fase 7 (Patrones)**: ✅ Completa — Config Provider (`core/config/app.config.ts` con `API_URL`, `GOOGLE_CLIENT_ID`, `APP_CONFIG` tokens + `provideAppConfig()`), `SearchInputComponent` (debounce configurable), `TypeFilterComponent` (button group filter), registrados en `app.config.ts` global provider y barrel de atoms
8. **Pendiente global**: responsive breakpoints (M8), interface segregation (IS1/IS2), chart extraction (SR1), testing suite
