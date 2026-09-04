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
| Decimales de COP             | **0** (uso cotidiano colombiano), no los 2 de ISO 4217             | Acordada  |
| Pago de préstamo             | **Dos movimientos**: capital (neutro) + interés (gasto)            | Acordada  |
| Transferencias recurrentes   | **Requeridas.** Materializan dos patas atómicamente                | Acordada  |
| Cierre de obligación         | `ObligationEntry` tipo `Closure`, importe cero, **sin** movimiento | Acordada  |
| Categoría en neutros         | Prohibida. Evita el doble conteo en reportes                       | Acordada  |
| `DebtPosition`               | No expone ningún "neto" deuda propia ↔ por cobrar                  | Acordada  |
| Dinero en el contrato        | `string` en cultura invariante, **nunca** `number`                 | Acordada  |
| Errores en el transporte     | **Problem Details (RFC 9457)** + extensión `code`; sin `Result<T>` | Acordada 04-09 |
| Motor de persistencia        | **PostgreSQL** con migraciones reproducibles                       | Acordada 04-09 |
| Alcance                      | **Multiusuario**: organizaciones, membresías y capacidades         | Acordada 04-09 |
| Autorización                 | Por capacidades efectivas. **Nunca por nombre de rol**             | Acordada 04-09 |
| Aislamiento entre organizaciones | En la frontera de persistencia, no en cada agregado            | Acordada 04-09 |
| Paginación                   | Por página y tamaño, con total. **No** por cursor                  | Acordada 04-09 |
| `MovementKindSpecDto`        | La tabla de invariantes viaja **como dato** al frontend            | Acordada  |
| Filtros y paginación         | DTOs en `Contracts`, no query strings armados en el cliente        | Acordada  |

## 2. Registro de ownership

| Ruta                              | Propietario         | Notas                                        |
| --------------------------------- | ------------------- | -------------------------------------------- |
| `apps/api/src/Finanzas.Domain/**`         | Agente backend | Entidades, value objects, invariantes         |
| `apps/api/src/Finanzas.Application/**`    | Agente backend | Casos de uso, comandos, consultas             |
| `apps/api/src/Finanzas.Infrastructure/**` | Agente backend | SQLite, migraciones, repositorios             |
| `apps/api/src/Finanzas.Host/**`           | Agente backend | Transporte local                              |
| `apps/api/src/Finanzas.Contracts/**`      | Agente backend | **Transferido** el 2026-09-03. Se congela con prueba de instantánea de superficie |
| `apps/api/Finanzas.slnx`                  | **Integrador**     | Alta de proyectos                             |
| `apps/api/HANDOFF.md`                     | **Integrador**     | Este archivo                                  |
| `electron/local-data/**`                  | **Integrador**     | Backend heredado. No se modifica en esta fase |
| `src/**` (Angular)                        | Agente frontend | Solo tras congelar `Contracts`                |

Ningún agente edita una ruta cuyo propietario sea otro. Los cambios en
`Contracts` se solicitan como propuesta y los aplica el integrador (§8.1, §8.8).

## 3. Estado actual

- [x] Esqueleto de solución creado y compilando (`dotnet build`, 0 errores, 0 advertencias).
- [x] Referencias entre proyectos cableadas según la dirección de dependencias.
- [x] Modelo de dominio. 35 archivos; verificado por el integrador: build limpio y
      165/165 pruebas en `Finanzas.Domain.Tests`. Mutación independiente sobre
      `MovementKindSpec` (declarar el pago de tarjeta como gasto) detectada por
      4 pruebas, dos de ellas nombradas por la regla 2. La suite tiene mordida.
- [x] Ajustes post-revisión aplicados: `COP` con 0 decimales en `Currency` (con
      reparto entero en `Money.Allocate`) y transferencias recurrentes de dos
      patas con materialización atómica e idempotente en `Recurrence`.
      Estado tras los ajustes: `dotnet test`, **198/198 en verde**, 0 errores y
      0 advertencias en la solución completa.
- [x] **Contratos congelados** (2026-09-04). 106 tipos públicos en
      `Finanzas.Contracts`, congelados con prueba de instantánea de superficie.
      `dotnet test`: **223/223 en verde**, 0 advertencias. Detalle en §5.
- [x] Multiusuario en el dominio (2026-09-04). `Organization`, `User`,
      `Membership` y `Capability`; 27 pruebas nuevas. Total del dominio:
      **225/225 en verde**.
- [x] Contrato ajustado a las decisiones del 04-09: `ProblemDetailsDto`
      sustituye a `ErrorDto`, y `Finanzas.Contracts.Identity` publica sesión,
      organización, membresías y capacidades. Instantánea regenerada y
      revisada. `dotnet test`: **252/252 en verde**.
- [ ] Esquema y migraciones **en PostgreSQL**, con aislamiento por organización.
- [ ] Casos de uso.
- [ ] Transporte local.

> **Cambio de orden respecto al plan inicial.** Los contratos se congelaron
> antes que el esquema y los casos de uso. Razón: "el frontend arranca al
> congelar `Contracts`" (§1), así que mientras el contrato no existiera el
> trabajo de interfaz estaba bloqueado y el de persistencia no. El contrato se
> deriva del dominio, que ya está cerrado y probado, no de los casos de uso.
> Si al escribirlos aparece un campo que falta, se pide como propuesta y se
> confirma junto con la instantánea actualizada.

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

## 5. Contrato congelado (2026-09-04)

### 5.1 Alcance

`Finanzas.Contracts` publica 115 tipos en trece espacios de nombres:

| Espacio de nombres | Qué cubre                                                             |
| ------------------ | --------------------------------------------------------------------- |
| `Common`           | `MoneyDto`, `ConvertedMoneyDto`, `CurrencyDto`, `PercentageDto`, `ProblemDetailsDto`, paginación y rango de fechas |
| `Identity`         | Sesión, organización, persona, membresías y capacidades               |
| `Ledger`           | `MovementDto`, `OperationDto`, `MovementKindSpecDto`, peticiones de alta, reclasificación y reverso, filtro y consulta |
| `Accounts`         | Cuenta, saldo proyectado y sus peticiones                              |
| `Categories`       | Categoría y sus peticiones                                             |
| `People`           | Persona y `DebtPositionDto`                                            |
| `Cards`            | Tarjeta, ciclo, condiciones y `CardStatusDto`                          |
| `Obligations`      | Obligación, entradas, política de interés, reparto de abonos           |
| `Investments`      | Posición, operaciones, valoraciones y resumen de patrimonio            |
| `Recurrences`      | Recurrente, calendario, materialización y ocurrencia proyectada        |
| `Purchases`        | Compra compartida y reparto entre personas                             |
| `Settlements`      | Liquidación por persona y periodo                                      |
| `Reporting`        | Resultado del periodo, totales por categoría y `DashboardDto`          |

### 5.2 Reglas del transporte que el frontend debe respetar

1. **El dinero es texto.** Cultura invariante, punto decimal, sin separador de
   miles, con la escala exacta de la moneda. Los decimales de cada código los
   publica `CurrencyDto`: `COP` opera con **0**. Parsear a `number` de
   JavaScript para hacer aritmética reintroduce el error que el backend evita.
2. **El signo no está en el importe.** `Amount` siempre es positivo; el sentido
   lo dan `Flow` (caja) y `Effect` (resultado), que son ejes independientes.
3. **Las invariantes viajan como dato.** El formulario dinámico se construye
   con `MovementKindSpecDto`, no con una tabla reescrita en TypeScript.
   Tampoco sustituye la validación: la palabra final es del servidor.
4. **Los anulados siguen contando.** `ReversalFilterDto` decide qué se muestra,
   nunca qué suma. El par original + reverso vale cero.
5. **No hay neto de deuda.** `DebtPositionDto` publica las dos caras separadas y
   restarlas en la interfaz contradice la regla financiera 3.
6. **Las proyecciones no son movimientos.** `ProjectedOccurrenceDto` no tiene id
   de ledger y ningún saldo la incluye.
7. **Errores en Problem Details.** Se ramifica sobre `ProblemDetailsDto.Code`;
   `Type` es ese mismo código en forma de URI (`urn:finanzas:` más el código),
   como exige el RFC 9457. `Title` y `Detail` son texto para humanos y su
   redacción puede cambiar.
8. **La organización no viaja en cada DTO**, viaja en `SessionDto`. El servidor
   acota cada consulta a la organización activa: el aislamiento no depende de
   que el cliente envíe el campo correcto.

### 5.3 Cómo se congela

`tests/Finanzas.Application.Tests/ContractSurface.approved.txt` guarda la
superficie pública completa —tipos, miembros de enum, propiedades con su
nulabilidad y sus accesores—. `ContractSurfaceTests` la compara en cada
ejecución. Congelar no es no cambiar nunca: es que no se pueda cambiar por
accidente mientras otro agente construye contra estos tipos.

Comprobado que la instantánea tiene mordida: quitarle el interrogante a
`MovementDto.Description` la rompe señalando la línea exacta.

`EnumParityTests` cubre el otro riesgo. Como `Contracts` no referencia a
`Domain`, los 21 enums espejo viven por duplicado; la prueba compara nombre y
valor de cada par y exige que todo enum nuevo del contrato se declare como
espejo o como propio del transporte.

### 5.4 Cómo se pide un cambio de contrato

1. Se describe el campo que falta y el caso de uso que lo necesita.
2. El agente backend lo aplica en `Finanzas.Contracts`.
3. Se borra `ContractSurface.approved.txt`, se ejecutan las pruebas para
   regenerarla y **se revisa el `diff`**: esa revisión es el punto de todo esto.
4. El cambio de contrato y la instantánea actualizada van en el mismo *commit*.

### 5.5 Deuda y riesgos conocidos

- El contrato se derivó del dominio, no de los casos de uso, que aún no
  existen. Es previsible que al escribirlos falte algún campo de lectura;
  faltarán campos, no cambiará la forma del dinero ni de los errores.
- `ErrorDto` **ya no existe**: lo sustituyó `ProblemDetailsDto` el 04-09, antes
  de que nadie escribiera un cliente contra él. Anunciado en
  `docs/agents/CONTRACT_HANDOFF.md`.
- No hay todavía tipos de transporte para escenarios y simuladores (§W12): se
  añadirán cuando el dominio los tenga.
- `Finanzas.Application` sigue vacío salvo el marcador de proyecto.

## 6. Reparto de tareas con el agente de frontend (2026-09-04)

Hay dos agentes trabajando a la vez sobre el mismo *checkout*. Ninguno
necesita esperar al otro si respeta esta división.

| Zona                        | Propietario activo | Estado                                  |
| --------------------------- | ------------------ | --------------------------------------- |
| `apps/api/**`               | Agente backend     | Dominio y contratos hechos              |
| `apps/web/**`               | Agente frontend    | En ejecución, no se toca desde el backend |
| `docs/agents/**`            | Punto neutral      | Se **añaden** entradas, no se reescriben |
| `src/**`, `electron/**`     | Aplicación heredada | Solo lectura en esta fase               |
| Planes y archivos de la raíz | El humano          | No se editan sin encargo explícito       |

**Canal.** `docs/agents/CONTRACT_HANDOFF.md`. Los dos agentes escriben ahí
añadiendo una entrada al final, con el formato que ese archivo declara. Nadie
edita archivos del otro para pedirle algo.

**Turno del backend, en orden:** persistencia y migraciones → casos de uso →
transporte y OpenAPI. Las cuatro decisiones abiertas registradas en el canal
bloquean el primer paso: el motor de base de datos y el alcance multiusuario
no son detalles de implementación que el backend deba elegir solo.

**Turno del frontend, sin bloqueo:** ya puede escribir sus adaptadores contra
los tipos congelados. Lo que todavía no existe es el transporte, así que no
hay OpenAPI del que generar un cliente ni URL que llamar.

## 7. Multiusuario: dónde vive el aislamiento (2026-09-04)

### 7.1 La decisión

Los agregados financieros —movimiento, cuenta, tarjeta, obligación,
posición— **no** llevan `OrganizationId`. La organización se exige en la
frontera de persistencia: cada repositorio recibe la organización activa y
ninguna consulta se puede escribir sin ella.

### 7.2 Por qué, y qué se pierde

Poner el campo en cada agregado parece más seguro, pero la garantía sería la
misma promesa repetida cuarenta veces: basta que un caso de uso olvide
asignarlo para escribir en la organización equivocada, y nada lo detendría.
Acotar en la consulta se comprueba una vez, en integración, contra una base de
datos real: se crean dos organizaciones, se escribe en una y se verifica que la
otra no ve absolutamente nada.

Lo que se pierde es que el compilador no obliga a pensar en la organización al
escribir un caso de uso. Se compensa con dos cosas: los repositorios no exponen
ningún método sin ámbito, y las pruebas de aislamiento son requisito para dar
por terminada la persistencia.

El precio de equivocarse aquí es que una persona vea el dinero de otra, así que
esta decisión no se cambia sin pruebas que la respalden.

### 7.3 Capacidades, no roles

`Membership.EffectiveCapabilities` es lo único contra lo que se autoriza.
Ninguna parte del sistema pregunta si alguien "es administrador": los conjuntos
de `CapabilitySets` son plantillas para escribir una membresía, no roles que se
consulten después. En cuanto el código pregunta por un rol, cambiar los permisos
de una persona exige tocar código en lugar de datos.

Una membresía invitada o suspendida no tiene ninguna capacidad efectiva, pero
conserva las escritas: suspender corta el acceso sin perder qué tenía la
persona, y reactivar se lo devuelve tal cual.

Lo que el dominio **no** puede garantizar es que una organización conserve al
menos un miembro con `ManageMembers`: esa regla mira todas las membresías a la
vez y le toca a la capa de aplicación antes de suspender o rebajar a la última.
Queda anotado aquí para que no se descubra el día que alguien se deje fuera de
su propia organización.

### 7.4 Lo que falta

- Persistencia: columna `organization_id` en cada tabla, índices que la
  encabecen y pruebas de aislamiento entre dos organizaciones.
- Autenticación: fuera del dominio y todavía sin decidir. El contrato no lleva
  credenciales y no las llevará.
- La sesión aún no existe como caso de uso; `SessionDto` describe su forma.
