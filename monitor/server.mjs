// Servidor estático sin dependencias para el monitor.
// Sirve esta carpeta para que index.html pueda leer state.json (fetch) y el sync en vivo funcione.
// Uso: pnpm start   (o: node server.mjs)   Node gestionado con Volta.
//
// Por defecto escucha en 127.0.0.2:80 para responder a http://proyectos.com (sin puerto visible)
// SIN chocar con la app Electron, que usa 127.0.0.1:80. El archivo hosts debe tener:
//   127.0.0.2   proyectos.com
// Configurable con las variables de entorno HOST y PORT.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const HOST = process.env.HOST || "127.0.0.2";
const PORT = Number(process.env.PORT || 80);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") path = "/index.html";
    // Evita path traversal
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }
    const info = await stat(file);
    if (info.isDirectory()) { res.writeHead(404).end("Not found"); return; }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  ✖ El puerto ${PORT} en ${HOST} ya está en uso.`);
    console.error(`    Cierra lo que lo ocupe o arranca en otra dirección/puerto, p. ej.:`);
    console.error(`      PORT=8080 pnpm start        (http://proyectos.com:8080)`);
    console.error(`      HOST=127.0.0.3 pnpm start   (otra IP de loopback)\n`);
  } else if (err.code === "EACCES") {
    console.error(`\n  ✖ Sin permiso para escuchar en ${HOST}:${PORT}.`);
    console.error(`    En Windows el puerto 80 no suele requerir admin; revisa reservas con:`);
    console.error(`      netsh interface ipv4 show excludedportrange protocol=tcp\n`);
  } else {
    console.error(`\n  ✖ Error del servidor:`, err.message, "\n");
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const shown = PORT === 80 ? "" : `:${PORT}`;
  console.log(`\n  ◆ Monitor del Orquestador · Finanzas Desktop`);
  console.log(`  ▸ Escuchando en:  http://${HOST}:${PORT}`);
  console.log(`  ▸ Con hosts (127.0.0.2  proyectos.com):  http://proyectos.com${shown}\n`);
});
