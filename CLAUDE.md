# Finanzas Desktop — Reglas del proyecto

## Gestión de Node y paquetes
- **Node se gestiona con Volta.** No instales/uses Node por otras vías (nvm, instalador manual).
  Fija versiones con `volta pin node@<ver>` / `volta pin pnpm@<ver>` (queda en el campo `volta` del `package.json`).
- **Usa SIEMPRE `pnpm`. Nunca `npm` ni `yarn`.**
  - Instalar deps: `pnpm install`
  - Añadir: `pnpm add <pkg>` / `pnpm add -D <pkg>`
  - Ejecutar scripts: `pnpm <script>` (p. ej. `pnpm start`, `pnpm dev`)
  - Ejecutables puntuales: `pnpm dlx <pkg>` (no `npx`).
  - Excepción única: herramientas Python (p. ej. Graphify) van por `uv`/`pipx`, no aplica pnpm.

## Monitoreo
- El tablero de monitoreo del orquestador + backlog scrum vive en [`monitor/`](monitor/). Ver [monitor/README.md](monitor/README.md).
- El grafo de conocimiento del código lo genera Graphify en `graphify-out/` (`graph.html`).
