# Plan maestro — Rediseño de `finanzas-desktop`

Une el **rediseño de base de datos** (ver [`DISENO_BD.md`](DISENO_BD.md)) con la **nueva arquitectura de UI**
(4 módulos + un formulario único) y el **rediseño de experiencia**. Se ejecuta **por fases con checkpoints**,
empezando por la base de datos.

Decisiones acordadas: BD relacional en claro centrada en `movements` · **Drizzle** (migraciones) · sin migración
de datos (desde cero) · quitar sync/API, HTTP/environment y entidades sin uso · **4 módulos** + Ajustes ·
**un solo formulario dinámico** para crear todo · rediseñar la UI de cada vista · diseño **extensible**.

---

## 1. Estado actual de la app (qué se usa, qué no, qué mejorar)

Revisión de las 12 vistas actuales (código; verificación en runtime pendiente en la fase de UI):

| Vista | Estado | ¿Usable? | Qué mejorar |
|-------|--------|----------|-------------|
| **dashboard** | Completa: granularidad, filtros globales, KPIs, cashflow, dona categorías, recientes, insights | Sí | Textos fijos en español (i18n), solapa con reports |
| **movements** | Muy completa (748/553 líneas), tabla + formulario propio con schema dinámico | Sí | Es la base del **formulario único**; extenderlo al resto |
| **reports** | 3 pestañas (general/categorías/mes a mes) + export CSV | Sí | **Estilos inline**, solapa con dashboard → volverlo módulo de analítica profunda |
| **portfolio** | Activos/pasivos, patrimonio neto, tabla, inspector | Sí | **Formularios bespoke** (nueva inversión, valorar) → mover al form único; falta posiciones/riesgo |
| **accounts** | Gestión de cuentas + saldos | Sí | Formulario propio → unificar |
| **cards** | Tarjetas + cuotas (529/423 líneas) | Sí | Formulario propio; reglas por tarjeta y extracto simulado (nuevo) |
| **loans** | Préstamos + amortización | Sí | Formulario propio; propósito/dirección (nuevo) |
| **recurring** | Recurrentes | Sí | Formulario propio; tipos (gasto fijo/suscripción/arriendo) |
| **installments** | Compras a cuotas | Parcial | Se integra dentro de Patrimonio/Movimientos, no como vista suelta |
| **calendar** | Vista calendario de movimientos | Sí | Integrar como vista dentro de Movimientos |
| **categories** | Gestión de categorías | Sí | Mover a Ajustes |
| **platform-tools** | Backup/restore/import/reparación | Sí | Mover a Ajustes |

**Patrón transversal a corregir:** cada vista trae su propio formulario en un `<app-modal>` → el objetivo es
**un único `DynamicFormComponent`** que los reemplace a todos.

---

## 2. Arquitectura destino: 4 módulos + Ajustes

| Módulo | Contenido | Absorbe de hoy |
|--------|-----------|----------------|
| **1. Dashboard** | Vistazo: KPIs, cashflow, categorías, recientes, insights | dashboard + financial-insights |
| **2. Movimientos** | Libro mayor + **formulario único** de creación + vista calendario + recurrentes | movements + recurring + calendar |
| **3. Patrimonio** | Cuentas, tarjetas (con reglas + extracto), préstamos, inversiones (posiciones/riesgo), patrimonio neto e histórico | accounts + cards + loans + portfolio + installments |
| **4. Reportes/Estadísticas** | Analítica profunda: comparativos, categorías, evolución, posiciones/riesgo, export | reports (ampliado) |
| *Ajustes (secundario)* | Categorías, herramientas locales (backup/import), tema/idioma/preferencias | categories + platform-tools + settings |

Se **eliminan como rutas propias**: installments, calendar, categories, platform-tools (pasan a ser vistas
internas de un módulo). Navegación (sidebar) pasa de ~12 ítems a **4 + Ajustes**.

---

## 3. Formulario único (motor de creación/edición)

- Reutilizar y extender el **`DynamicFormComponent`** (`shared/ui/organisms/dynamic-form`) y el patrón de
  `movement-form.schema.ts`.
- **Un solo componente** genera el formulario a partir de un **schema por tipo de operación**: Ingreso, Gasto,
  Transferencia, Préstamo (tomar/otorgar), Compra a cuotas, Pago de tarjeta, Recurrente, Inversión/valoración.
- El usuario elige el **tipo** y el formulario presenta **solo los campos y opciones que aplican**. **Nunca** se
  crea un `<form>`/modal propio por vista.
- Cada creación termina en uno o varios `movements` (y, si aplica, en la fila de contrato: loan, installment,
  recurring, portfolio_entity).

---

## 4. Rediseño de experiencia (principios)

- Consistencia total vía librería `shared/ui` (atoms/molecules/organisms); **cero estilos inline**, cero texto
  fijo (todo i18n).
- Layout por módulo coherente: cabecera + KPIs + contenido + panel/inspector; acciones siempre en el mismo lugar.
- Estados de carga/vacío/error uniformes (ya existen `skeleton`, `empty-state`).
- Densidad y tema respetados (ya hay `ThemeService`).

---

## 5. Roadmap por fases (con checkpoint entre cada una)

**Fase 1 — Base de datos (empezamos aquí).**
Drizzle + `drizzle-kit`; esquema de las 12 tablas + vistas `v_*` (`DISENO_BD.md`); reescritura de
`electron/local-data/database.js`; ajustar `ipc.js`/`preload.js`; quitar sync + entidades sin uso; tests de BD.

**Fase 2 — Capa de datos del front + formulario único.**
Adaptar `local-data.repository.ts` y los `*-api.service.ts` al nuevo contrato; quitar HttpClient/interceptor;
consolidar el `DynamicFormComponent` como motor único y sus schemas por tipo.

**Fase 3 — Reorganización en 4 módulos + rediseño UX.**
Reestructurar rutas/navegación a 4 módulos + Ajustes; migrar cada vista, reemplazar formularios bespoke por el
único; añadir tarjetas con reglas/extracto, inversiones con posiciones/riesgo, patrimonio histórico.

**Fase 4 — Tests + verificación + commit único.**
Actualizar specs; `pnpm lint` → `pnpm build` → `pnpm test` → `pnpm test:electron` en verde; commit final.

---

## 6. Nota

Los documentos `AUDITORIA.md` y `DISENO_BD.md` quedan como soporte. El refactor F-01…F-11 se absorbe dentro de
este trabajo (F-01 test roto y F-02 lint se resuelven en la Fase 4).
