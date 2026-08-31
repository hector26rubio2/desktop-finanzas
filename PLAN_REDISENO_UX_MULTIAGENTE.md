# Plan maestro de rediseño UX/UI y ejecución multiagente

> Proyecto: Finanzas Desktop  
> Estado: listo para planificación y ejecución coordinada  
> Audiencia: Codex, Claude y OpenCode, incluidos sus subagentes  
> Idioma de trabajo: español  
> Regla de paquetes: usar únicamente `pnpm`, conforme a `CLAUDE.md`

## 1. Propósito

Rediseñar integralmente Finanzas Desktop para convertirla en una aplicación financiera personal clara, estilizada, consistente, accesible y agradable de usar. Se permite rehacer por completo una vista cuando la jerarquía actual no pueda corregirse con cambios locales.

La aplicación debe sentirse como un **estudio financiero personal**, no como un panel administrativo genérico. El objetivo no es ocultar datos, sino mostrar primero lo importante y revelar el detalle de forma progresiva.

## 2. Resultados esperados

- Movimiento será el eje transversal de ingresos, gastos, transferencias, tarjetas, recurrentes, inversiones, préstamos, obligaciones y abonos.
- Existirá un único sistema de formulario dinámico reutilizable, configurable y prellenado por contexto.
- Todas las tablas usarán un patrón compartido de ancho, scroll, acciones, selección y accesibilidad.
- El detalle contextual se mostrará en un inspector compartido lateral o inferior.
- Dashboard, Movimientos, Cuentas, Categorías, Recurrentes, Calendario, Tarjetas, Patrimonio, Reportes, Datos y Configuración tendrán una jerarquía coherente.
- La vista independiente de Cuotas/Compras y la vista heredada de Préstamos se retirarán durante su reemplazo, sin destruir datos históricos ni compatibilidad.
- La arquitectura quedará preparada para migrar progresivamente el dominio y la persistencia a .NET 10 y desacoplar la interfaz del contenedor de escritorio.
- Existirá un conjunto aislado de datos demo de tres meses para validar estados realistas.
- La aplicación funcionará sin overflow del documento en móvil, tablet, escritorio y ultrawide.
- Todos los temas, densidades y formas conservarán contraste, distribución y legibilidad.

## 3. Principios de producto

### 3.1 Minimalismo funcional

- No usar espacio vacío como sustituto de jerarquía.
- Mantener densidad donde los datos la requieren.
- Evitar paneles o tarjetas de gran tamaño con poco contenido.
- Mostrar una sola acción principal evidente por vista.
- Reservar el detalle avanzado para inspectores, drawers o expansiones.

### 3.2 Lenguaje visual

- Fondos sobrios y superficies con separación suave.
- Bordes discretos; no convertir cada bloque en una caja aislada.
- Sombras solo en elementos elevados: modal, inspector, menú y popover.
- Color de acento para selección y acción; color semántico para ingreso, gasto, alerta y deuda.
- Números financieros con cifras tabulares.
- Iconografía consistente, visible y de un único estilo.
- Transiciones breves, predecibles y compatibles con reducción de movimiento.

### 3.3 Anatomía común de pantalla

Cada vista debe organizarse en cuatro niveles:

1. **Orientación:** título, periodo y contexto.
2. **Decisión:** resumen y KPIs que explican el estado.
3. **Acción:** acción primaria y filtros necesarios.
4. **Exploración:** tabla, gráfico o colección con detalle progresivo.

### 3.4 Política de scroll

- El documento nunca debe tener scroll horizontal.
- La página puede desplazarse verticalmente cuando la narrativa lo requiere.
- Las tablas largas desplazan únicamente su región de filas; toolbar y encabezado permanecen visibles.
- Inspectores y modales desplazan únicamente su cuerpo; cabecera y acciones permanecen visibles.
- Las celdas del calendario nunca crecen indefinidamente ni crean scroll interno.
- Ocultar flechas de scrollbar y usar thumbs delgados, discretos y estables.
- Evitar scroll anidado salvo en regiones de datos que lo necesiten explícitamente.

## 4. Arquitectura UX transversal

### 4.1 Movimiento como fuente de verdad

Toda operación con impacto en dinero debe quedar representada o enlazada con un movimiento:

- ingreso y gasto;
- transferencia;
- compra y pago de tarjeta;
- materialización de recurrente;
- aporte, retiro, compra, venta, dividendo y comisión de inversión;
- creación, desembolso, cobro, interés, abono, reverso y cierre de préstamo;
- compra prestada a otra persona y liquidación de cuentas por cobrar.

Las valoraciones de inversión no son flujo de caja y se conservarán como serie separada, enlazada a la entidad de portafolio. Las vistas especializadas son proyecciones del ledger de movimientos, no implementaciones financieras paralelas.

Un préstamo es una proyección sobre movimientos enlazados, no un saldo editable aislado. El principal, los intereses, los abonos y los ajustes conservan su propio movimiento y trazabilidad. Un abono nunca modifica retroactivamente el importe original.

### 4.2 Formulario dinámico único

Separar las siguientes responsabilidades:

- catálogo y metadatos de campos;
- construcción del `FormGroup`;
- opciones asíncronas de cuenta, categoría y moneda;
- visibilidad condicional;
- validación y errores;
- valores iniciales y prellenado;
- transformación a comandos de dominio;
- secciones visuales;
- modo crear, editar y duplicar.

Tipos mínimos:

- texto, número, moneda, fecha y fecha/hora;
- select y autocomplete;
- selector de cuenta y categoría;
- switch compacto;
- control segmentado;
- campos condicionales;
- grupos repetibles cuando sean necesarios.

Adaptadores previstos:

- movimiento;
- recurrente;
- pago de tarjeta;
- operación de inversión;
- transferencia;
- compra con tarjeta propia o prestada;
- préstamo, cuenta por cobrar y abono;
- escenario confirmado que se materializa como operación real.

No se permiten formularios completos duplicados en templates de cada feature.

### 4.3 DataTable compartida

El componente de tabla debe:

- ocupar el 100% del ancho disponible;
- mantener toolbar, filtros y header fuera del scroll vertical;
- desplazar solo las filas cuando crece el dataset;
- conservar altura al paginar;
- ofrecer búsqueda, orden y columnas visibles;
- usar prioridades responsive para columnas;
- mantener la columna de acciones sticky y accesible;
- no esconder el menú de acciones por overflow;
- admitir selección por teclado y abrir el inspector;
- anunciar resultados, carga y errores;
- conservar foco visible y región desplazable accesible.

No implementar `tbody { display: block }` de forma aislada si rompe la alineación de columnas. La solución puede usar header sticky dentro de una región de filas o una composición header/body sincronizada, pero el resultado visual debe mantener el header inmóvil.

### 4.4 Inspector compartido

- Escritorio: panel lateral de altura completa del área de contenido.
- Tablet y móvil: panel inferior o pantalla compacta, según espacio disponible.
- Cabecera fija.
- Cuerpo desplazable.
- Acciones fijas.
- Sin footer flotante extraño.
- Reutilizado por movimiento, día de calendario, tarjeta, cuenta y patrimonio.

### 4.5 Filtros compartidos

- Filtros primarios visibles.
- Filtros secundarios dentro de “Más filtros”.
- Filtros activos representados como chips removibles.
- Periodo siempre comprensible.
- Restablecer visible pero secundario.
- Sin textos cortados o selects más estrechos que su contenido mínimo.

## 5. Workstreams funcionales

### W0 — Línea base, inventario y datos demo

#### Trabajo

- Inventariar vistas, estados, rutas, componentes y estilos compartidos.
- Crear capturas base por vista y tema.
- Crear un generador de datos aislado para un perfil temporal de demostración.
- Generar al menos tres meses de información:
  - cuatro tarjetas;
  - entre 80 y 120 movimientos;
  - ingresos, gastos, transferencias, pagos y recurrentes;
  - varias cuentas y categorías;
  - inversiones y valoraciones;
  - estados activos e inactivos;
  - nombres largos y monedas distintas.

#### Restricciones

- Nunca insertar fixtures en el perfil real del usuario.
- El seed debe ser repetible y eliminable.
- Usar perfil temporal en pruebas automatizadas.

#### Aceptación

- Las pruebas pueden ejecutar estados vacío, pocos datos y datos abundantes.
- Existe una matriz de capturas en 390, 768, 1024, 1280 y 1440 px.

### W1 — Tokens, scrollbars y primitives

#### Trabajo

- Consolidar tokens de superficie, texto, borde, sombra, foco y estados.
- Normalizar altura de controles, radios y paddings.
- Eliminar tokens inexistentes y estilos inline críticos.
- Definir scrollbar compartida sin flechas.
- Verificar hover, focus, active, selected y disabled.
- Verificar todos los temas, densidades y formas.

#### Aceptación

- Ningún `var(--token)` requerido queda sin definición o fallback válido.
- Contraste AA en controles y texto.
- Cambiar tema no altera el layout.

### W2 — Formulario dinámico, modal e inspector

#### Trabajo

- Completar el formulario dinámico único y sus adaptadores.
- Convertir checkbox grandes en switch o checkbox compacto.
- Organizar campos por secciones y columnas responsive.
- Mantener modal en top layer y separar cabecera, cuerpo y acciones.
- Completar inspector responsive compartido.

#### Aceptación

- Crear y editar prellenan correctamente.
- Recurrente e inversión reutilizan el sistema, no copian un formulario.
- Modal e inspector permanecen dentro del viewport en cualquier scroll.
- Solo el cuerpo se desplaza.

### W3 — DataTable compartida

#### Trabajo

- Rediseñar estructura y API del componente.
- Resolver header fijo, body-scroll y acciones sticky.
- Estabilizar paginación y altura.
- Añadir variantes de densidad y columnas responsive.
- Conservar accesibilidad y navegación de teclado.

#### Aceptación

- Tabla al 100% del área.
- No hay salto de ancho o altura al paginar.
- El header no desaparece al recorrer filas.
- El menú de acciones funciona en la primera y última fila.
- No hay overflow del documento.

### W4 — Dashboard y Movimientos

#### Dashboard

- Integrar “Filtro global” y sus cinco controles en una barra coherente.
- Reservar espacio estable para Restablecer.
- Escritorio: una fila; tablet: dos filas equilibradas; móvil: apilado.
- Rehacer KPIs con igual altura, padding y línea base.
- Evitar alineación global a la derecha; usar centro o izquierda según la lectura.
- Reorganizar la narrativa:
  1. estado actual;
  2. qué cambió;
  3. qué requiere atención;
  4. en qué se gasta;
  5. qué viene después.
- Limitar alturas de gráficos y paneles.

#### Movimientos

- Usar todo el ancho.
- Toolbar compacta con periodo, búsqueda, filtros y acción principal.
- KPIs compactos y nivelados.
- DataTable compartida.
- Inspector de detalle.
- Formulario dinámico único para crear, editar y duplicar.
- Secciones opcionales para recurrente e inversión.

#### Aceptación

- “Filtro global” nunca queda debajo o separado de sus controles.
- Los KPIs forman una retícula estable en todas las resoluciones.
- Movimientos no cambia de geometría con 1, 20 o 100 filas.

### W5 — Cuentas, Categorías y Recurrentes

#### Cuentas

- Corregir renderizado de iconos.
- Añadir activar/desactivar.
- Identificar inactivas sin degradar el contraste global.
- Tabla al 100%.
- Reemplazar “por defecto” grande por switch compacto.
- Acciones disponibles desde fila e inspector.

#### Categorías

- Corregir iconos.
- Usar DataTable compartida.
- Mantener acción de tres puntos visible y utilizable.
- Formulario con vista previa de color e icono.
- Selector de iconos compacto y con búsqueda.

#### Recurrentes

- Tarjetas con ancho máximo; no estirarlas a toda la pantalla.
- Reutilizar el adaptador del formulario de Movimiento.
- Añadir únicamente la sección de programación.
- Switch activo/pausado compacto.
- Mostrar monto, frecuencia, próximo evento y estado con jerarquía clara.

### W6 — Calendario y Tarjetas

#### Calendario

- No permitir crecimiento por cantidad de eventos.
- Mostrar máximo dos o tres eventos y un indicador “+N”.
- Seleccionar día abre inspector con la agenda completa.
- Seleccionar movimiento abre su detalle.
- Sin scroll vertical dentro de celdas.
- Sin deformación ultrawide.
- En móvil, preferir agenda compacta antes que forzar una grilla ilegible.

#### Tarjetas

- Toolbar compacta con búsqueda y dos filtros sin overflow.
- Eliminar el espacio blanco producido por la composición actual de filtros y KPIs.
- Mostrar resumen general y galería uniforme.
- Seleccionar tarjeta abre inspector lateral o panel inferior.
- El detalle incluye deuda, cupo, ciclo, pagos, compras y compromisos.
- El detalle no empuja ni expande toda la página.
- Compras usa la DataTable compartida.
- Al registrar una compra, permitir indicar si corresponde al titular o a otra persona.
- Para compras prestadas, seleccionar o crear el deudor y asignar responsabilidad total, porcentual o por importe fijo.
- Permitir abonos parciales y mostrar saldo pendiente, historial y aplicación de cada abono.
- Generar por persona una liquidación verificable con compras, intereses atribuibles, abonos, ajustes, vencimientos y total por pagar.
- Soportar compras compartidas por varias personas sin perder la porción del titular.
- Validar que las asignaciones no superen el total financiado y registrar los redondeos.

### W7 — Patrimonio e inversiones

#### Patrimonio

- Inspector de altura completa.
- Eliminar footer extraño y cortes inferiores.
- Tabla al 100% con body-scroll.
- Validar múltiples activos, pasivos e inversiones.
- Compactar y alinear KPIs de activos, pasivos y patrimonio neto.

#### Inversiones

- Aporte, retiro, compra, venta, dividendo y comisión generan o enlazan un movimiento.
- La valoración permanece separada del flujo de caja.
- Mostrar posición, costo, valor, rendimiento e historial de movimientos.
- Drill-down desde inversión hacia Movimientos.

### W8 — Reportes

#### Preguntas que debe responder

- ¿Dónde cambió el comportamiento financiero?
- ¿Qué gasto está creciendo?
- ¿Cuánto se está ahorrando?
- ¿Qué compromisos vienen?
- ¿Qué cuenta o tarjeta concentra riesgo?
- ¿Qué parte del gasto es recurrente?
- ¿Cómo evolucionó el patrimonio?

#### Métricas propuestas

- flujo neto;
- tasa de ahorro;
- gastos fijos frente a variables;
- carga de deuda;
- variación contra el mes anterior;
- promedio móvil de tres meses;
- proyección de cierre;
- concentración por cuenta, tarjeta y categoría.

#### Tabla de ingresos y egresos

Añadir cuando sea significativo:

- cantidad de movimientos;
- total;
- promedio;
- mediana;
- participación del periodo;
- variación mensual;
- moneda base;
- cuenta o fuente principal;
- tendencia.

#### Categorías en reportes

- iconos visibles;
- cambio mensual;
- crecimiento atípico;
- recurrentes relacionados;
- drill-down directo a Movimientos.

### W9 — Shell, Datos y Configuración

#### Menú lateral

- Mantener cabecera y perfil accesibles.
- Desplazar solo los grupos centrales.
- Configuración y Datos y recuperación siempre alcanzables con menú expandido.
- Verificar foco, teclado y altura reducida.

#### Datos y recuperación

Reorganizar en bloques:

- estado local;
- respaldo;
- restauración;
- exportación/importación;
- diagnóstico.

Mostrar estado y última acción sin grandes espacios vacíos. Separar acciones peligrosas.

#### Configuración

- Eliminar la sección inicial “Ajustes” y accesos duplicados.
- Abrir directamente Perfil o la última sección usada.
- Eliminar etiquetas rígidas “claro/oscuro” en temas.
- La preview representa fondo, superficie, texto y acento reales.
- Añadir entre seis y nueve tipografías locales, con licencias revisadas.
- Agrupar tipografías por carácter: neutral, moderna, editorial y compacta.
- Conservar idioma, moneda, densidad y forma.

#### Atajos

- Reemplazar tabla por cuadrícula de comandos.
- Agrupar navegación, creación, búsqueda y sistema.
- Mostrar combinaciones como chips de teclado.

#### Acerca de

- Usar layout completo.
- Separar versión, privacidad, almacenamiento local, licencias y soporte.

### W10 — Retirada segura de la UI heredada de Cuotas y Préstamos

#### Trabajo

- Retirar de navegación, buscador de comandos y accesos del dashboard las vistas heredadas mientras se reemplazan.
- Mantener rutas antiguas como redirecciones a Movimientos con contexto cuando sea posible.
- No borrar tablas, datos, modelos ni migraciones.
- Mantener lectura de históricos.
- Actualizar traducciones y pruebas de navegación.

#### Aceptación

- No existe acceso UI activo a la vista independiente de Cuotas/Compras ni a la vista heredada de Préstamos.
- Los enlaces antiguos no terminan en página rota.
- Ningún dato histórico se elimina.

### W11 — Personas, préstamos, obligaciones y abonos

#### Modelo funcional

- Entidad Persona/Contraparte reutilizable con nombre, alias, contacto opcional, estado y notas.
- Una obligación puede originarse en una compra con tarjeta, un préstamo directo o un ajuste documentado.
- Relacionar obligación, persona, movimientos, tarjeta/cuenta, moneda, fechas, tasa y regla de distribución.
- Crear un movimiento por cada desembolso, cargo, interés, abono, reverso, ajuste y cierre.
- El préstamo conserva condiciones y calendario como proyección; su saldo se deriva del ledger de movimientos.
- Definir reglas de aplicación de abonos: capital primero, intereses primero, proporcional o selección manual.
- Soportar abonos parciales, anticipados, reversos y sobrepagos controlados.
- Mantener ledger por persona con saldo inicial, cargos, intereses, abonos, ajustes y saldo resultante.
- Ejecutar operaciones compuestas de forma atómica e idempotente.

#### Experiencia

- Reemplazar la vista heredada por “Personas y deudas”, con resumen por persona y obligaciones relacionadas.
- Seleccionar una persona abre inspector con obligaciones, cronograma, movimientos y acciones.
- Desde una compra de tarjeta se puede asignar deudor sin abandonar el formulario de Movimiento.
- “Registrar abono” reutiliza el formulario compartido prellenado desde persona, obligación, compra o movimiento.
- Generar liquidación por persona y periodo, con desglose y opción de exportar o compartir.
- Distinguir claramente deuda propia, dinero prestado, vencido, por vencer y pagado.

#### Reglas financieras y aceptación

- Política de interés configurable: sin interés, tasa fija, tasa periódica o tasa heredada de la tarjeta.
- Conservar moneda original y moneda base; no sumar monedas sin conversión explícita.
- Usar precisión decimal y una política documentada de redondeo.
- Los cambios de regla no recalculan silenciosamente periodos cerrados.
- Toda liquidación conserva versión, fecha de corte y entradas utilizadas.
- Asignar una compra completa o parcial a una o varias personas debe cuadrar con el total.
- Reversar un abono restaura el saldo sin borrar auditoría.
- Reportes distinguen deuda propia y cuentas por cobrar a terceros.

### W12 — Proyecciones, planes de pago, metas y simuladores

#### Centro de proyección financiera

- Consolidar deuda por tarjeta, préstamo y obligación, separando deuda propia de cuentas por cobrar.
- Permitir una meta: quedar libre de deuda en una fecha o respetar una cuota mensual máxima.
- Generar planes comparables: avalancha, bola de nieve, cuota fija y estrategia personalizada.
- Considerar tasa, cuota mínima, corte, vencimiento, abonos extraordinarios, ingresos disponibles y restricciones.
- Mostrar cronograma mensual, intereses totales, fecha estimada de finalización, ahorro frente al escenario base y flujo disponible.
- Explicar supuestos y advertir cuando una meta no sea viable; una proyección no es una garantía.
- Un plan aprobado puede generar presupuesto y recordatorios, pero no movimientos futuros como si ya hubieran ocurrido.

#### Simulador de compra y tarjeta

- Comparar una compra entre tarjetas según tasa, cuotas, comisiones, moneda, corte, beneficios configurados y cupo.
- Mostrar pago mensual, costo financiero, costo total, tiempo, utilización de cupo e impacto en flujo mensual.
- Simular abono inicial y extraordinarios; comparar comprar ahora, aplazar o ahorrar primero.
- Guardar escenarios sin crear movimientos; al confirmar, abrir el formulario único prellenado.

#### Metas y presupuestos

- Crear metas para viaje, compra u objetivo con monto, fecha, moneda y aporte periódico.
- Proponer aporte requerido y fecha alcanzable en escenarios conservador, esperado y flexible.
- Mostrar el impacto conjunto de meta y plan de deuda para evitar recomendaciones incompatibles.
- Vincular progreso a movimientos reales; los ajustes manuales quedan auditados.

#### Motor y UX

- Comparación lado a lado, controles compactos y resultados con resumen, cronograma y supuestos.
- Diferenciar datos reales, supuestos y recomendaciones calculadas.
- Motor de cálculo con funciones puras, deterministas y separado de la UI.
- Cubrir tasa cero, pagos insuficientes, redondeos, monedas, fechas de corte y años bisiestos.
- Versionar fórmulas para reproducir escenarios guardados.
- No usar IA generativa para producir cifras; solo para explicar resultados del motor determinista.

### W13 — Preparación y migración progresiva a .NET 10

#### Objetivo arquitectónico

Desacoplar Angular de Electron y de la persistencia local para que la UI consuma contratos de aplicación estables. .NET 10 alojará gradualmente dominio, casos de uso, cálculos y persistencia; Electron podrá mantenerse temporalmente como host y luego sustituirse sin reescribir la experiencia web.

#### Arquitectura objetivo

- `Domain`: entidades, value objects, reglas e invariantes sin dependencias de UI o SQLite.
- `Application`: casos de uso, comandos, consultas, validación y transacciones.
- `Infrastructure`: SQLite, migraciones, backups, importación/exportación y adaptadores externos.
- `Contracts`: DTO y esquema versionado compartido con el frontend.
- `Host`: API local o transporte seguro independiente del framework de escritorio.
- `Web UI`: Angular consume únicamente un puerto cliente tipado.
- `Desktop Host`: adaptador reemplazable; no contiene reglas financieras.

#### Estrategia strangler, no big bang

1. Inventariar dependencias con Graphify y congelar contratos actuales.
2. Introducir puertos TypeScript para Movimiento, consultas, simulación, backup y configuración.
3. Crear pruebas contractuales sobre el comportamiento existente.
4. Implementar primero en .NET 10 el motor determinista de proyecciones y planes de pago.
5. Migrar ledger/casos de uso de Movimiento y operaciones atómicas.
6. Migrar lecturas y reportes por verticales, manteniendo adaptador Electron como fallback temporal.
7. Migrar persistencia y restauración con compatibilidad de la base SQLite actual.
8. Sustituir el transporte y luego evaluar el host de escritorio definitivo.
9. Eliminar código heredado solo después de paridad, migración verificada y una versión de compatibilidad.

#### Contratos y seguridad local

- API versionada y errores tipados; no exponer detalles de SQLite al frontend.
- Transporte local autenticado, con origen restringido y sin puerto público por defecto.
- Operaciones monetarias idempotentes y transaccionales.
- Compatibilidad de backups y migraciones de ida probada sobre copias, nunca sobre el único archivo real.
- Telemetría desactivada por defecto y datos financieros siempre locales salvo consentimiento explícito.

#### Criterios de aceptación

- Angular funciona contra un adaptador en memoria, el backend Electron heredado y .NET 10 con las mismas pruebas contractuales.
- Ningún componente importa IPC, SQLite o Drizzle directamente.
- Movimiento sigue siendo el ledger central en ambos backends.
- El motor .NET reproduce casos de cálculo conocidos y paridad con fixtures existentes.
- Se puede abrir, migrar, auditar, respaldar y restaurar una base previa sin pérdida.
- El empaquetado actual continúa funcionando durante la transición.

## 6. Mejoras de experiencia comunes

### 6.1 Estados vacíos

Cada vacío explica:

- qué falta;
- para qué sirve la vista;
- cuál es la siguiente acción.

### 6.2 Carga

- Skeleton con la geometría del contenido final.
- Actualización local por componente.
- No bloquear toda la pantalla por una tabla o gráfico.
- No producir saltos de layout.

### 6.3 Errores y confirmaciones

- Error junto al campo o componente afectado.
- Mensajes con una solución comprensible.
- Deshacer cuando sea seguro.
- Confirmación fuerte solo para acciones destructivas.

### 6.4 Microinteracciones

- Hover y feedback entre 120 y 200 ms.
- Selección visible.
- Sin animaciones de tamaño que desplacen contenido.
- Soporte de `prefers-reduced-motion`.
- Tooltips solo para conceptos no evidentes.
- Menús con texto; evitar iconos ambiguos sin nombre accesible.

## 7. Arquitectura de navegación objetivo

```text
Inicio
└── Dashboard

Dinero
├── Movimientos
├── Cuentas
├── Tarjetas
└── Recurrentes

Análisis
├── Calendario
├── Patrimonio
└── Reportes

Sistema
├── Categorías
├── Datos y recuperación
└── Configuración
```

Debe existir una acción global **Nuevo movimiento** capaz de iniciar ingreso, gasto, transferencia, pago de tarjeta, recurrente u operación de inversión.

## 8. Protocolo de ejecución entre Codex, Claude y OpenCode

### 8.1 Regla principal

Ningún agente debe editar un archivo que tenga otro propietario activo. Los cambios compartidos se acuerdan mediante contrato y los aplica el integrador.

### 8.2 Roles sugeridos

| Rol                                  | Responsable sugerido | Alcance                                                                 |
| ------------------------------------ | -------------------- | ----------------------------------------------------------------------- |
| Integrador y arquitectura compartida | Codex                | contratos, shared UI, rutas finales, integración, pruebas y empaquetado |
| Dirección UX y vistas de dinero      | Claude               | Dashboard, Movimientos, Cuentas, Categorías, Recurrentes y Calendario   |
| Vistas de análisis y sistema         | OpenCode             | Tarjetas, Patrimonio, Reportes, Shell, Datos y Configuración            |

La asignación puede cambiar, pero el ownership de archivos debe registrarse antes de empezar.

### 8.3 Archivos exclusivos del integrador

- `src/styles/**`
- `src/app/shared/ui/**`
- `src/app/shared/forms/**`
- `src/app/shared/services/theme.service.ts`
- `src/app/app.routes.ts`
- `src/app/shell/navigation.catalog.ts`
- `src/app/app.component.*`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/e2e-smoke.mjs`
- configuración de build, release y Electron

Los demás agentes proponen cambios a estos contratos, pero no los modifican sin transferencia explícita de ownership.

### 8.4 Lanes después de congelar contratos

#### Lane A — Claude

- `src/app/features/dashboard/**`
- `src/app/features/movements/**`
- `src/app/features/accounts/**`
- `src/app/features/categories/**`
- `src/app/features/recurring/**`
- `src/app/features/calendar/**`

#### Lane B — OpenCode

- `src/app/features/cards/**`
- `src/app/features/portfolio/**`
- `src/app/features/reports/**`
- `src/app/features/platform-tools/**`
- `src/app/features/settings/**`
- componentes del shell asignados explícitamente

#### Lane C — Codex

- primitives y contratos compartidos;
- fixtures y pruebas;
- navegación y redirecciones;
- retirada visual de Cuotas y Préstamos;
- integración final.

### 8.5 Flujo de ramas y worktrees

- Crear una rama o worktree por lane.
- Prefijo recomendado: `codex/`, `claude/` y `opencode/`.
- No trabajar tres agentes en el mismo checkout.
- Primero se integra Foundation: W0–W3.
- Los lanes se rebasan sobre Foundation ya estable.
- Cada commit debe cubrir una unidad revisable.
- No mezclar refactor transversal y rediseño de varias pantallas en el mismo commit.

### 8.6 Contratos que deben congelarse antes de paralelizar

- tokens y aliases CSS;
- API del formulario dinámico;
- API de DataTable;
- API del inspector;
- tipos de filtro;
- contrato Movimiento/Inversión;
- política de scroll y breakpoints;
- catálogo de navegación objetivo.

### 8.7 Formato de handoff obligatorio

Cada agente entrega:

1. alcance completado;
2. archivos modificados;
3. decisiones tomadas;
4. cambios de contrato solicitados;
5. pruebas ejecutadas y resultado;
6. capturas o evidencia visual;
7. riesgos y deuda restante;
8. instrucciones de integración.

No se acepta “terminado” sin evidencia de prueba.

### 8.8 Resolución de conflictos

- Detener el lane cuando necesite modificar un archivo exclusivo.
- Documentar el cambio requerido como propuesta de contrato.
- El integrador aplica el cambio compartido.
- Los lanes actualizan su base y continúan.
- Nunca resolver un conflicto conservando ambas implementaciones duplicadas.

## 9. Orden de implementación

### Etapa 1 — Foundation bloqueante

1. W0: inventario, capturas y seed.
2. W1: tokens y primitives.
3. W2: formulario, modal e inspector.
4. W3: DataTable.

No iniciar rediseños masivos antes de congelar estos contratos.

### Etapa 2 — Trabajo paralelo

- Lane A: W4 y W5, luego Calendario de W6.
- Lane B: Tarjetas de W6, W7, W8 y partes de W9.
- Lane C: shell compartido, fixtures, pruebas y compatibilidad.

### Etapa 3 — Integración

1. Integrar Dashboard y Movimientos.
2. Integrar Cuentas, Categorías y Recurrentes.
3. Integrar Calendario y Tarjetas.
4. Integrar Patrimonio e Inversiones.
5. Integrar Reportes.
6. Integrar Shell, Datos y Configuración.
7. Ejecutar W10 y redirecciones.

### Etapa 4 — QA y release candidate

- Auditoría visual completa.
- Accesibilidad.
- Pruebas con datos abundantes.
- Build, tests y empaquetado.
- Validación del ejecutable empaquetado.

## 10. Matriz mínima de validación

### Resoluciones

- 390 × 844
- 768 × 900
- 1024 × 768
- 1280 × 800
- 1440 × 900
- ultrawide de referencia

### Apariencia

- todos los temas predefinidos;
- temas personalizados representativos;
- densidad compacta, cómoda y amplia;
- forma redondeada y angulada;
- reducción de movimiento.

### Datos

- carga;
- vacío;
- error;
- una fila;
- una página completa;
- varias páginas;
- nombres y cifras extremas;
- entidades activas e inactivas.

### Interacción

- ratón;
- teclado;
- foco visible;
- scroll;
- resize con modal o inspector abierto;
- navegación con sidebar expandido y colapsado.

## 11. Pruebas obligatorias por entrega

### 11.1 Graphify como mapa de impacto

El repositorio ya define Graphify como fuente del grafo de conocimiento en `graphify-out/graph.html`. Antes de crear worktrees:

1. regenerar el grafo con el comando documentado en `CLAUDE.md` y ejecutar sus herramientas Python aisladas mediante `uv` o `pipx`;
2. no editar manualmente los artefactos generados;
3. localizar dependencias de Movimientos, Préstamos, Cuotas, Tarjetas, Reportes, auditoría y recuperación;
4. adjuntar a cada handoff los módulos afectados y dependencias compartidas detectadas;
5. regenerar el grafo después de integrar contratos y al cerrar la implementación;
6. usar el grafo como análisis de impacto, no como sustituto de pruebas ni revisión.

Graphify es obligatorio antes de retirar rutas heredadas, cambiar modelos financieros, extraer código hacia .NET 10 o repartir ownership, para evitar romper reportes, backups o integridad referencial.

```powershell
pnpm format:check
pnpm lint
pnpm test
pnpm test:electron
pnpm test:ui
```

Para un release candidate de Windows:

```powershell
pnpm dist:win
pnpm test:packaged:win
```

La publicación oficial permanece bloqueada si falta la firma digital requerida.

## 12. Definición de terminado

Una vista se considera terminada únicamente cuando:

- responde claramente su pregunta principal;
- tiene una acción primaria evidente;
- usa componentes compartidos y no duplica lógica;
- no presenta overflow horizontal del documento;
- sus tablas desplazan filas sin perder header o acciones;
- funciona con datos vacíos y abundantes;
- funciona en todas las resoluciones objetivo;
- mantiene contraste AA y teclado completo;
- conserva geometría durante carga y paginación;
- tiene pruebas y evidencia visual;
- no introduce errores de consola;
- fue revisada en al menos un tema claro, uno oscuro y uno personalizado.

El proyecto completo se considera listo cuando además:

- Movimiento es la fuente transversal de operaciones;
- formularios, tablas e inspectores comparten contratos estables;
- la UI heredada de Cuotas/Compras y Préstamos ya no aparece;
- Personas y deudas permite asignar compras, registrar abonos y liquidar saldos por persona;
- el centro de proyección genera planes y simulaciones reproducibles;
- los puertos y pruebas contractuales permiten iniciar la migración a .NET 10 sin acoplar Angular al host;
- sidebar, Configuración y Datos son siempre accesibles;
- el seed de tres meses y la suite responsive pasan;
- el ejecutable empaquetado supera el smoke test.

## 13. Lista de riesgos

- Duplicar lógica financiera al migrar inversiones o recurrentes.
- Romper alineación de columnas al separar header y body.
- Introducir scroll anidado por resolver cada pantalla de forma local.
- Conflictos frecuentes en estilos, rutas y navegación.
- Borrar datos al retirar vistas que solo deben ocultarse.
- Cargar fuentes remotas o sin licencia adecuada.
- Aplicar “minimalismo” eliminando contexto necesario.
- Validar únicamente estados vacíos.
- Rehacer demasiadas pantallas antes de estabilizar primitives.
- Calcular intereses o redondeos de forma distinta entre Tarjetas, Préstamos y simuladores.
- Confundir cuentas por cobrar a terceros con deuda propia en KPIs.
- Materializar escenarios como movimientos antes de una confirmación explícita.
- Intentar migrar a .NET 10 mediante una reescritura total sin pruebas de paridad.

## 14. Registro de decisiones

Antes de implementar, crear o actualizar una tabla de decisiones dentro de este archivo:

| Fecha     | Decisión                                     | Responsable        | Impacto                        | Estado      |
| --------- | -------------------------------------------- | ------------------ | ------------------------------ | ----------- |
| Pendiente | API final de formulario dinámico             | Integrador         | Todos los formularios          | Por definir |
| Pendiente | Estrategia final de header/body de DataTable | Integrador         | Todas las tablas               | Por definir |
| Pendiente | Comportamiento móvil del inspector           | Equipo UX          | Todas las vistas               | Por definir |
| Pendiente | Contrato Movimiento/Inversión                | Arquitectura       | Patrimonio y reportes          | Por definir |
| Pendiente | Aplicación de abonos e intereses             | Dominio financiero | Personas, Tarjetas y Préstamos | Por definir |
| Pendiente | Política decimal, redondeo y moneda          | Dominio financiero | Ledger y simuladores           | Por definir |
| Pendiente | Fórmulas del motor de proyección             | Integrador         | Planes, metas y simuladores    | Por definir |
| Pendiente | Transporte local y host objetivo .NET 10     | Arquitectura       | Desacople de escritorio        | Por definir |

## 15. Instrucción de inicio para cualquier agente

1. Leer este archivo completo y `CLAUDE.md`.
2. Consultar el registro de decisiones.
3. Confirmar el workstream y ownership asignado.
4. Revisar cambios no confirmados antes de editar.
5. No tocar archivos exclusivos de otro lane.
6. Implementar una unidad pequeña y verificable.
7. Ejecutar pruebas proporcionales al cambio.
8. Entregar el handoff obligatorio.

Este documento es la fuente de coordinación. Si una implementación contradice el plan, debe actualizarse primero la decisión correspondiente y comunicarla a los demás lanes.
