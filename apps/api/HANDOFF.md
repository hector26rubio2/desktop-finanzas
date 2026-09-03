# Handoff — Backend .NET 10 (`apps/api`)

> Conforme a `PLAN_REDISENO_UX_MULTIAGENTE.md` §8.7 (formato de handoff) y §8.5
> (registro de rutas y propietario antes de crear archivos nuevos).

## 1. Decisiones tomadas (2026-09-03)

| Decisión                     | Valor                                                            | Estado    |
| ---------------------------- | ---------------------------------------------------------------- | --------- |
| Stack del backend            | .NET 10 (`net10.0`, SDK 10.0.302)                                 | Acordada  |
| Arquitectura                 | Domain / Application / Infrastructure / Contracts / Host          | Acordada  |
| Esquema de datos             | Nuevo y completo, modelado por funcionalidad (no extiende el actual) | Acordada  |
| Base de datos real           | Intacta. No se migra ni se toca en esta fase                      | Acordada  |
| Orden de trabajo             | Backend primero; frontend arranca al congelar `Contracts`         | Acordada  |
| Precisión monetaria          | `decimal`, nunca `double`/`real`                                   | Acordada  |

## 2. Registro de ownership

| Ruta                              | Propietario         | Notas                                        |
| --------------------------------- | ------------------- | -------------------------------------------- |
| `apps/api/src/Finanzas.Domain/**`         | Agente backend | Entidades, value objects, invariantes         |
| `apps/api/src/Finanzas.Application/**`    | Agente backend | Casos de uso, comandos, consultas             |
| `apps/api/src/Finanzas.Infrastructure/**` | Agente backend | SQLite, migraciones, repositorios             |
| `apps/api/src/Finanzas.Host/**`           | Agente backend | Transporte local                              |
| `apps/api/src/Finanzas.Contracts/**`      | **Integrador**     | Congelado tras W11. Cambios por propuesta     |
| `apps/api/Finanzas.slnx`                  | **Integrador**     | Alta de proyectos                             |
| `apps/api/HANDOFF.md`                     | **Integrador**     | Este archivo                                  |
| `electron/local-data/**`                  | **Integrador**     | Backend heredado. No se modifica en esta fase |
| `src/**` (Angular)                        | Agente frontend | Solo tras congelar `Contracts`                |

Ningún agente edita una ruta cuyo propietario sea otro. Los cambios en
`Contracts` se solicitan como propuesta y los aplica el integrador (§8.1, §8.8).

## 3. Estado actual

- [x] Esqueleto de solución creado y compilando (`dotnet build`, 0 errores, 0 advertencias).
- [x] Referencias entre proyectos cableadas según la dirección de dependencias.
- [ ] Modelo de dominio.
- [ ] Esquema y migraciones.
- [ ] Casos de uso.
- [ ] Contratos congelados.
- [ ] Transporte local.

### Dirección de dependencias (invariante arquitectónica)

```text
Host  →  Infrastructure  →  Application  →  Domain
                                   ↓
                              Contracts
```

`Domain` no referencia nada. `Contracts` no referencia nada. Cualquier
referencia que invierta una flecha es un defecto arquitectónico.

## 4. Reglas financieras vinculantes

Derivadas de §4.1, §W11 y §13 del plan. No son negociables sin actualizar
primero el registro de decisiones del plan.

1. **Movimiento es el ledger central.** Toda operación con efecto económico
   produce o enlaza un movimiento. Las vistas especializadas (préstamos,
   tarjetas, inversiones) son proyecciones sobre él, no saldos editables.
2. **El efecto económico se registra una sola vez.** Crear un contrato,
   calcular una liquidación o marcar un préstamo saldado no genera por sí solo
   ingreso ni gasto. Distinguir movimiento monetario, devengo y metadato.
3. **Deuda propia ≠ cuenta por cobrar.** Lo adeudado al emisor de una tarjeta
   sigue siendo del titular aunque exista un deudor. No se compensa
   automáticamente ni se da el cobro por garantizado.
4. **`decimal` siempre.** Política de redondeo documentada y explícita.
5. **Nunca sumar monedas sin conversión explícita.** Se conserva moneda
   original y moneda base.
6. **Un abono no modifica retroactivamente el importe original.** Reversar
   restaura el saldo sin borrar auditoría.
7. **Operaciones compuestas atómicas e idempotentes.**
8. **Los cambios de regla no recalculan periodos cerrados en silencio.**
9. **Toda liquidación conserva versión, fecha de corte y entradas usadas.**
10. **Las proyecciones no son garantías** y jamás se materializan como
    movimientos sin confirmación explícita.
