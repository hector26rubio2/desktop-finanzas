# Prompt de ejecución — Backend Finanzas

> **Encargo cumplido, 2026-09-08.** Este es el prompt que puso en marcha el backend, y se
> conserva por eso: dice qué se pidió y bajo qué reglas. **No es una tarea pendiente ni
> describe dónde está el código hoy** —habla de `apps/api`, que ya no existe; el backend
> vive en [`v2-api-finanzas`](https://github.com/hector26rubio2/v2-api-finanzas) y está
> desplegado—. Las reglas financieras de más abajo sí siguen vigentes y se cumplen en él;
> la de autorización se endureció: ya no basta con «capacidades efectivas», cada endpoint
> exige un permiso granular. Ver `docs/PERMISOS-MATRIZ.md` en ese repositorio.

Eres el agente propietario del backend nuevo de Finanzas. Trabaja exclusivamente en `apps/api/**`. La aplicación legacy y `electron/local-data/**` son de solo lectura. El frontend nuevo está en `apps/web/**` y tiene otro propietario.

## Objetivo

Construir desde cero un backend .NET 10 con Minimal APIs, separación Domain/Application/Infrastructure/Contracts/Host, PostgreSQL, migraciones y operaciones financieras centradas en el ledger de Movimientos. Publicar OpenAPI mediante Scalar y entregar una colección Bruno ejecutable antes de conectar el frontend.

## Reglas vinculantes

- Lee completos `CLAUDE.md`, `PLAN_REDISENO_UX_MULTIAGENTE.md` y `apps/api/HANDOFF.md` antes de editar.
- Respeta el ownership registrado. No edites `apps/web`, el backend legacy, planes o archivos raíz sin handoff.
- No hardcodees roles. Aplica autorización por capacidades efectivas y organización en el servidor.
- Usa `decimal` y política explícita de moneda/redondeo. No sumes monedas sin conversión.
- Un préstamo es una proyección sobre movimientos. Abonos, intereses, transferencias, compras e inversiones registran una sola vez su efecto económico.
- Mantén deuda bancaria y cuentas por cobrar separadas.
- Operaciones compuestas atómicas e idempotentes; correcciones mediante versiones/reversos auditables.
- No implementes criptografía propia. Deja decisiones de tokens de un uso y cifrado de payload detrás de interfaces hasta aprobar un protocolo revisado.

## Entregables

1. Solución compilable y pruebas de dominio.
2. PostgreSQL con migraciones reproducibles, restricciones e índices multi-tenant.
3. Casos de uso y contratos versionados para sesión/capacidades, movimientos, cuentas, tarjetas, personas, obligaciones, inversiones, notificaciones, planificación y paginación por cursor.
4. Minimal APIs con validación, Problem Details, idempotencia, autorización y auditoría.
5. OpenAPI y UI Scalar en desarrollo, protegida o desactivada según entorno.
6. `apps/api/bruno/` con colección, entornos local/test sin secretos y flujos positivos/negativos.
7. Pruebas unitarias, integración con PostgreSQL y contractuales; reporte de comandos y resultados.

## Coordinación

- Publica primero el OpenAPI/contratos congelados. El frontend genera/adapta su cliente desde ese contrato; nunca adivina payloads.
- Para solicitar cambios del frontend, añade una entrada en `docs/agents/CONTRACT_HANDOFF.md`; no edites sus archivos.
- Tras cada unidad, actualiza `apps/api/HANDOFF.md` con alcance, archivos, migraciones, pruebas, riesgos y próxima dependencia.
- No marques como terminado un endpoint sin aislamiento entre organizaciones, autorización, idempotencia cuando corresponda y pruebas de error.

## Orden

Dominio → contratos → persistencia/migraciones → casos de uso → endpoints → Scalar/Bruno → integración/autorización → observabilidad. Mantén commits pequeños y no mezcles refactor con features no relacionadas.
