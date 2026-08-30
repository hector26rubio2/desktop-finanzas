# Monitor del Orquestador — Finanzas Desktop

Tablero para **monitorear en vivo** los agentes del orquestador (grafo con estado de ejecución,
**pipeline de pasos intermedios**) y llevar el **backlog con metodología scrum**
(Backlog · Planeadas · En ejecución · Hechas).

## Qué incluye

- **Grafo de agentes** (arriba izq.): orquestador al centro y cada agente alrededor con su estado
  (`ejecutando`/`en cola`/`hecho`/`inactivo`/`error`), pulso animado al ejecutar y la tarea en curso.
  Clic en un agente → **filtra** sus tareas.
- **Pipeline en vivo** (abajo izq.): por cada agente activo, la **secuencia de pasos intermedios** del
  proceso con su estado (`pendiente`/`ejecutando`/`hecho`/`error`) y el **tiempo transcurrido** de la tarea.
- **Tablero scrum** (derecha): tarjetas **arrastrables** entre columnas, con agente, prioridad, puntos,
  progreso de pasos y comentarios. **Filtros** por agente y por estado en la barra superior.
- **Detalle de tarea** (clic en tarjeta): cambia estado/prioridad/agente/puntos, **avanza pasos**
  (clic en un paso lo cicla pendiente→ejecutando→hecho), **añade pasos** y **comentarios**.
- **Log del proceso** (abajo der.): historial cronológico de cambios de estado, movimientos y comentarios.
- **Sello "Actualizado …"** en la cabecera y **sync en vivo** cada 5 s desde `state.json`.
- Persistencia local en `localStorage`; botones `↻ Recargar`, `⭳ Exportar`, `Reset`.

## Requisitos (reglas del proyecto)

- **Node** gestionado con **Volta** — `package.json` fija `node 24.18.0` y `pnpm 10.34.5`.
- **pnpm** como gestor de paquetes (nunca `npm`). Sin dependencias externas: el servidor es Node puro.

## Cómo ejecutarlo

```bash
cd monitor
pnpm start
```

Por defecto escucha en **`127.0.0.2:80`** para responder a `http://proyectos.com` **sin puerto visible**,
sin chocar con tu app Electron (que usa `127.0.0.1:80`). Configurable:

```bash
PORT=8080 pnpm start        # http://proyectos.com:8080
HOST=127.0.0.3 pnpm start   # otra IP de loopback
```

---

## Los 3 pasos manuales

### 1. Apuntar `proyectos.com` a tu PC (requiere administrador)

El archivo `hosts` solo mapea nombre → IP (no puertos). Por eso usamos la IP de loopback `127.0.0.2`
(libre) y dejamos el `127.0.0.1:80` para tu app Electron.

Abre un editor **como administrador** y añade esta línea a
`C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.2   proyectos.com
```

Comando (PowerShell **como administrador**):

```powershell
Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "`r`n127.0.0.2`tproyectos.com"
ipconfig /flushdns
```

Verifica: `ping proyectos.com` debe responder `127.0.0.2`. Luego abre <http://proyectos.com>.

### 2. Dejarlo "siempre corriendo" (auto-arranque al iniciar sesión)

```powershell
cd monitor
.\scripts\autostart-install.ps1     # registra la Tarea Programada "FinanzasMonitor"
Start-ScheduledTask -TaskName FinanzasMonitor   # arrancarlo ya, sin reiniciar
```

Quitar el auto-arranque:

```powershell
.\scripts\autostart-remove.ps1
```

> No suele requerir administrador (tarea del propio usuario). Si Windows lo pide, abre la consola
> "como administrador".

### 3. Nota sobre el puerto 80

- El monitor usa `127.0.0.2:80`; tu app Electron usa `127.0.0.1:80`. **No chocan.**
- En Windows el puerto 80 no suele requerir admin. Si aparece `EACCES`, revisa reservas:
  `netsh interface ipv4 show excludedportrange protocol=tcp`.
- Si prefieres no usar el 80, arranca con `PORT=8080` y entra a `http://proyectos.com:8080`.

---

## Conectarlo al orquestador real

Es *data-driven*: escribe el estado de agentes/tareas/pasos en **`state.json`** y el monitor lo refleja
solo (polling cada 5 s). Estructura:

```jsonc
{
  "orchestrator": { "id": "orchestrator", "name": "Orquestador", "status": "running" },
  "agents": [
    { "id": "coder", "name": "Coder", "role": "Implementación",
      "status": "running", "currentTask": "t-5" }   // status: idle|queued|running|done|error
  ],
  "columns": [ { "id": "backlog", "title": "Backlog" }, ... ],
  "tasks": [
    { "id": "t-5", "title": "…", "status": "doing", "agent": "coder",
      "priority": "high", "points": 5,
      "startedAt": "2026-08-16T10:05:00Z",           // para el tiempo transcurrido
      "steps": [                                       // pasos INTERMEDIOS del proceso
        { "name": "Sort por columna", "status": "done",    "at": "2026-08-16T10:15:00Z" },
        { "name": "Filtro de texto",  "status": "running", "at": "2026-08-16T10:35:00Z" },
        { "name": "Persistir",        "status": "pending", "at": null }
      ],
      "comments": []
    }
  ]
}
```

`status` de un paso: `pending | running | done | error`.

**Merge en vivo:** `state.json` manda sobre el estado de agentes y los `steps`; agrega tareas nuevas al
Backlog; **no sobrescribe** las tareas/comentarios que ya editaste. Usa `Reset` para volver 100 % a `state.json`.

## Archivos

| Archivo                         | Rol                                                     |
|---------------------------------|---------------------------------------------------------|
| `index.html`                    | UI: grafo + pipeline + scrum + log + comentarios        |
| `state.json`                    | Estado de agentes, tareas y pasos (fuente en vivo)      |
| `server.mjs`                    | Servidor estático Node sin dependencias (127.0.0.2:80)  |
| `package.json`                  | Scripts pnpm + pin de Volta                             |
| `scripts/autostart-install.ps1` | Registra la Tarea Programada de auto-arranque           |
| `scripts/autostart-remove.ps1`  | Quita la Tarea Programada                               |
