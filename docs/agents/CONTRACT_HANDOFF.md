# Contrato de coordinación backend ↔ frontend

Este archivo es el punto neutral para Codex, Claude Code, GitHub Copilot, OpenCode y otros agentes. No reemplaza Git ni autoriza editar ownership ajeno.

> **Fase cerrada.** El registro de abajo cubre la etapa en que backend y frontend vivían
> en este monorepo, bajo `apps/api` y `apps/web`. Ya no es así: el código se movió a dos
> repositorios propios y esas rutas no existen. Las entradas fechadas **se conservan sin
> tocar**, porque son el registro de qué se decidió y cuándo; leerlas como estado de hoy
> sería un error. El estado de hoy es el de esta sección.

## Estado

| | |
|---|---|
| Backend | [`hector26rubio2/v2-api-finanzas`](https://github.com/hector26rubio2/v2-api-finanzas) — .NET 10, PostgreSQL, desplegado en Render |
| Frontend | [`hector26rubio2/gestor-Finanzas`](https://github.com/hector26rubio2/gestor-Finanzas) — Angular, desplegado en GitHub Pages |
| Este repositorio | La aplicación de escritorio y la coordinación. No contiene ni el backend ni el frontend nuevos |

- **Contrato HTTP: publicado.** Hay transporte —Minimal APIs bajo `/api/v1`— y
  autenticación con Google sobre cookie de sesión con CSRF. La integración real está
  hecha: el frontend consume la API.
- **La documentación OpenAPI existe pero no se sirve en producción.** El documento y la
  interfaz Scalar van detrás de `exposeApiDocs`, así que `/openapi/v1.json` y `/scalar`
  responden en local y no en el despliegue: no los busques allí.
- **La superficie sigue congelada** con la prueba de instantánea, ahora en
  `tests/Finanzas.Application.Tests/ContractSurface.approved.txt` del repositorio del
  backend.
- **La documentación viva está en cada repositorio**, no aquí:
  `docs/PERMISOS-MATRIZ.md` y `SUPERADMIN.md` en el backend.

## Formato de solicitud

```md
### AAAA-MM-DD — Título

- Solicitante:
- Propietario requerido:
- Caso de uso:
- Contrato actual:
- Cambio mínimo propuesto:
- Compatibilidad/migración:
- Pruebas de contrato:
- Estado: propuesta | aceptada | implementada | rechazada
```

## Reglas

- Backend posee DTO, OpenAPI, persistencia y semántica financiera. Vive en `v2-api-finanzas`.
- Frontend posee presentación, interacción y adaptadores cliente. Vive en `gestor-Finanzas`.
- Los importes en contratos no usan `number` binario; siguen la decisión documentada por backend.
- Paginación, filtros, capacidades y errores se definen en Contracts y se prueban en ambos lados.
- Ningún secreto, cookie, token real o dato personal se escribe en este archivo.

## Registro de solicitudes

### 2026-09-04 — Contrato congelado y disponible en `apps/api/src/Finanzas.Contracts`

- Solicitante: agente backend (Claude Code, sesión `desktop-04`).
- Propietario requerido: ninguno. Es un anuncio, no una petición de cambio ajeno.
- Caso de uso: desbloquear al frontend, que según `apps/api/HANDOFF.md` §1
  arranca cuando `Contracts` se congela.
- Contrato actual: 106 tipos públicos en doce espacios de nombres —`Common`,
  `Ledger`, `Accounts`, `Categories`, `People`, `Cards`, `Obligations`,
  `Investments`, `Recurrences`, `Purchases`, `Settlements`, `Reporting`—.
  Congelado con prueba de instantánea de superficie
  (`tests/Finanzas.Application.Tests/ContractSurface.approved.txt`).
  Estado: `dotnet test` 223/223 en verde.
- Cambio mínimo propuesto: ninguno sobre archivos del frontend.
- Compatibilidad/migración: no aplica. Nada del frontend consumía este backend.
- Pruebas de contrato: `ContractSurfaceTests` congela la superficie;
  `EnumParityTests` verifica los 21 enums espejo contra el dominio.
- Estado: implementada.

**Lo que el frontend debe saber antes de escribir su adaptador**
(el detalle largo está en `apps/api/HANDOFF.md` §5.2):

1. El dinero es `string` en cultura invariante, nunca `number`. Los decimales
   de cada moneda los publica `CurrencyDto`: `COP` opera con **0**.
2. El importe siempre es positivo. El sentido lo dan `Flow` (caja) y `Effect`
   (resultado), que son ejes independientes.
3. `MovementKindSpecDto` viaja como dato: el formulario dinámico se construye
   con esa tabla, no con una copia reescrita en TypeScript.
4. Los movimientos anulados siguen contando en los saldos. `ReversalFilterDto`
   decide qué se muestra, nunca qué suma.
5. `DebtPositionDto` no trae neto y la ausencia es deliberada: deuda propia y
   cuenta por cobrar no se compensan.
6. `ProjectedOccurrenceDto` no tiene id de ledger. Una ocurrencia futura no es
   un movimiento y ningún saldo la incluye.
7. Se ramifica sobre `ErrorDto.Code`; `Message` es texto para humanos.

**Aún no hay OpenAPI.** No existe transporte todavía: lo que está congelado son
los tipos, no las rutas. Un cliente generado tendrá que esperar al Host.

### 2026-09-04 — Cuatro decisiones abiertas antes de la persistencia

- Solicitante: agente backend.
- Propietario requerido: el humano. Ningún agente debería resolverlas solo.
- Caso de uso: `docs/agents/BACKEND_EXECUTOR_PROMPT.md` describe un backend que
  no coincide en cuatro puntos con lo ya decidido en `apps/api/HANDOFF.md` §1 y
  ya construido. Seguir cualquiera de los dos documentos en silencio deja al
  otro agente construyendo contra algo falso.
- Contrato actual frente a lo pedido en ese prompt:

  | Punto        | Decidido y construido                        | Pedido en el prompt de ejecución       |
  | ------------ | -------------------------------------------- | -------------------------------------- |
  | Persistencia | SQLite local (ownership de `Infrastructure`) | PostgreSQL con índices multi-tenant    |
  | Errores      | `ErrorDto` con código estable                | Problem Details (RFC 9457)             |
  | Paginación   | `PageRequestDto`/`PageDto<T>` por página     | Paginación por cursor                  |
  | Alcance      | Aplicación personal de escritorio            | Organizaciones, sesiones y capacidades |

- Cambio mínimo propuesto: que el humano decida cada punto. Los dos primeros
  tocan la superficie congelada; los dos últimos cambian el alcance del backend.
- Compatibilidad/migración: cambiar errores o paginación implica regenerar la
  instantánea aprobada y avisar aquí antes de que el frontend escriba su cliente.
- Pruebas de contrato: la instantánea hará visible cualquiera de esos cambios.
- Estado: propuesta.

### 2026-09-04 — Auditoría de integración del prototipo web contra Contracts congelados

- Solicitante: agente coordinador frontend/backend (Codex).
- Propietario requerido: backend para transporte y contratos ausentes; frontend para el adaptador HTTP.
- Caso de uso: sustituir `DemoStore`/`DataProvider` en memoria por la API sin duplicar reglas financieras ni romper la interfaz existente.
- Contrato actual: `Finanzas.Contracts` cubre ledger, cuentas, categorías, personas, tarjetas, obligaciones, inversiones, recurrentes, compras compartidas, liquidaciones y reporting. `Finanzas.Host` solo publica `GET /` con `Hello World!`; todavía no existen rutas funcionales, OpenAPI ni Scalar.
- Cambio mínimo propuesto: el backend publica rutas versionadas y OpenAPI; propone DTO separados para sesión/capacidades, feature flags, preferencias, notificaciones y administración; el frontend añade un adaptador HTTP que mantiene el dinero como decimal textual positivo y aplica `Flow`/`Effect`; se documentan fechas, zona horaria y límite de página.
- Compatibilidad/migración: el fixture visual actual usa importes `number` firmados, tarjetas dentro de cuentas, ids `string`, cuatro clases de movimiento y paginación local. Permanecerá aislado detrás del proveedor demo y no será fuente de reglas financieras de producción.
- Pruebas de contrato: build .NET limpio y 223/223 pruebas verdes en esta fecha. Antes de integrar se requieren pruebas OpenAPI/HTTP de dinero, fechas, enums, errores y tamaños 5/10/25, verificando además que tarjeta no se deserialice como cuenta, deuda no se netee y pago/transferencia permanezcan neutros.
- Estado: propuesta; integración HTTP bloqueada hasta que el backend publique OpenAPI.

### 2026-09-04 — Slice BI enlazado, detalle financiero y preferencias ampliadas

- Solicitante: usuario propietario del producto.
- Propietarios: frontend implementa primero contra `DataProvider`; backend/Claude publica contratos y proyecciones equivalentes.
- Dashboard: filtros globales combinables por granularidad (`week`, `month`, `year`), rango, categoría, cuenta y tipo de tarjeta. Cada widget puede tener filtro local; la acción «aplicar al dashboard» lo promueve al contexto global. Todos los KPIs, gráficas y tablas deben mostrar el mismo contexto y exponer los filtros activos.
- Movimientos: la proyección de lectura debe incluir tipo económico (débito/crédito), instrumento, moneda, tasa aplicada y fuente/fecha de la tasa, recurrencia, préstamo/obligación relacionada, cuota actual/total y propiedad (`own`, `lent`, `shared`) con persona responsable cuando aplique. Estos son metadatos/relaciones del movimiento, no saldos paralelos.
- Tarjetas: admitir moneda distinta de la moneda base. La TRM/tasa consultada por backend mediante el proveedor acordado se guarda como cotización fechada; el movimiento conserva para siempre la tasa elegida (`provider`, `configured` o `manual`) y su valor. Nunca recalcular histórico con la tasa de hoy.
- Cuentas: listado paginado 5/10/25 con total, orden estable y proyección de saldo; detalle paginado de movimientos con los campos anteriores. El backend pagina, el frontend no descarga todo para recortar localmente en producción.
- Calendario: consulta por mes/año y rango; navegación anterior/siguiente y selector directo. El día devuelve resumen estable y abre agenda/detalle, sin aumentar la altura de la cuadrícula.
- Preferencias: presets ilimitados, tema personalizado por tokens, tipografías autorizadas e idiomas (`es-CO`, `en-US`, `pt-BR`, `fr-FR`). La capacidad `theme.customize` controla edición, no el nombre de un rol.
- Reportes: flujo de caja, categorías, patrimonio, deuda/tarjetas, presupuestos, personas/cuentas por cobrar, recurrencias, moneda/impacto cambiario y proyección de compromisos; todos reciben el mismo contrato de filtros globales.
- Pruebas de contrato requeridas: combinación de filtros, aislamiento por organización, paginación 5/10/25, moneda/tasa histórica inmutable, cuotas, préstamo, recurrencia y propiedad compartida/prestada.
- Estado: frontend en implementación; backend pendiente de transporte/OpenAPI.

### 2026-09-04 — Resueltas las cuatro decisiones abiertas. El contrato cambió

- Solicitante: agente backend.
- Propietario requerido: ninguno. Anuncio de un cambio ya aplicado en
  `apps/api`, decidido por el humano en la sesión de chat.
- Caso de uso: cerrar las discrepancias registradas en la entrada anterior
  antes de escribir la persistencia.
- Decisiones tomadas:

  | Punto        | Decisión                                          |
  | ------------ | ------------------------------------------------- |
  | Persistencia | **PostgreSQL**                                    |
  | Errores      | **Problem Details (RFC 9457)**                    |
  | Paginación   | **Por página y tamaño**, con total. No por cursor |
  | Alcance      | **Multiusuario**: organizaciones y capacidades    |

- Cambio mínimo aplicado al contrato:
  - `ErrorDto` y `ErrorFieldDto` **se eliminaron**. Los sustituyen
    `ProblemDetailsDto` y `ProblemFieldDto`. Se sigue ramificando sobre `Code`;
    `Type` es ese mismo código como URI (`urn:finanzas:` más el código).
  - Nuevo espacio `Finanzas.Contracts.Identity`: `SessionDto`,
    `OrganizationDto`, `UserDto`, `MembershipDto`, `CapabilityDto`,
    `MembershipStatusDto` y sus peticiones.
  - **La organización no viaja en cada DTO.** Va en `SessionDto`, una vez. El
    servidor acota cada consulta a la organización activa; el aislamiento no
    depende de que el cliente mande el campo correcto.
  - `CapabilityDto` sirve para no ofrecer un botón que va a fallar, **no** para
    proteger nada: ocultar una acción en la interfaz no impide llamarla.
  - La paginación no cambia: `PageRequestDto` y `PageDto<T>` siguen igual.
- Compatibilidad/migración: ninguna. El cambio se hizo antes de que existiera
  un cliente escrito contra el contrato. Si `apps/web` ya tenía tipos de error,
  ahora son los de Problem Details.
- Pruebas de contrato: `dotnet test` 252/252 en verde. La instantánea aprobada
  pasa de 106 a 115 tipos; `EnumParityTests` cubre ya 23 enums espejo.
- Estado: implementada.

**Aún no hay OpenAPI ni autenticación.** El contrato describe la forma de la
sesión, no cómo se obtiene. Esa decisión sigue abierta y no la toma un agente.

### 2026-09-08 — Cierre del registro: dos repositorios, en producción

- Solicitante: agente backend (Claude Code).
- Propietario requerido: ninguno. Es un cierre, no una petición de cambio ajeno.
- Caso de uso: las entradas anteriores dejaban dos cosas «pendientes» que ya no lo están
  —OpenAPI y autenticación—, y describían rutas de un monorepo que ya no existe. Sin esta
  entrada, un agente que lea el registro construye contra un mapa caducado.
- Qué cambió respecto de la última entrada:

  | Punto | Estado al cerrar |
  | --- | --- |
  | Transporte | Publicado. Minimal APIs versionadas bajo `/api/v1`. OpenAPI y Scalar existen, cerrados en producción |
  | Autenticación | Google sobre cookie de sesión, con CSRF de doble envío y límite de tasa |
  | Ubicación | Dos repositorios propios. `apps/api` y `apps/web` no existen |
  | Despliegue | Backend en Render con `autoDeploy` desde `main`; frontend en GitHub Pages |
  | Autorización | Por permiso granular, no por capacidad |

- **La autorización dejó de ser lo que describe la entrada del 4 de septiembre.**
  Allí `CapabilityDto` servía «para no ofrecer un botón que va a fallar, **no** para
  proteger nada». Eso ya no basta y no es lo que hay: cada endpoint exige un código
  concreto del catálogo (`recurso.subrecurso.accion`, 112 códigos), un rol guarda esos
  códigos en vez de una máscara de catorce bits, y la capacidad se deriva de ellos —
  quitar una acción la retira. Ocultar el botón sigue siendo cortesía; lo que protege es
  la política del endpoint. El detalle está en `docs/PERMISOS-MATRIZ.md` del backend.
- La capacidad `theme.customize` que menciona la entrada del slice BI es hoy
  `preferencias.tema.editar`. El vocabulario de pantalla se retiró entero.
- Compatibilidad/migración: no aplica a este archivo. Los cambios de contrato que hubo se
  hicieron en el repositorio del backend con su instantánea aprobada al día.
- Pruebas de contrato: 411 pruebas en el backend y 84 en el frontend, en verde, con CI en
  `main` de ambos repositorios.
- Estado: implementada. **Este registro queda cerrado.** La coordinación entre los dos
  repositorios se lleva ahora en sus propios PR e issues, que es donde está el código.
