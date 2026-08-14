const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };

function serverFor(distPath) {
  const root = path.resolve(distPath);
  return http.createServer((request, response) => {
    let requested = '/';
    try { requested = decodeURIComponent((request.url || '/').split('?')[0]); } catch (_) {}
    if (requested === '/') requested = '/index.html';
    let file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    try {
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      response.end(fs.readFileSync(file));
    } catch (_) { response.writeHead(404); response.end('Not found'); }
  });
}

async function startLocalServer(distPath) {
  for (const port of [80, 4269, 0]) {
    const result = await new Promise((resolve) => {
      const server = serverFor(distPath);
      server.once('error', () => resolve(null));
      server.listen(port, '127.0.0.1', () => {
        const selected = server.address().port;
        resolve({ server, port: selected, origin: selected === 80 ? 'http://localhost' : `http://localhost:${selected}` });
      });
    });
    if (result) return result;
  }
  throw new Error('No local port is available');
}

module.exports = { startLocalServer };
