const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serverFor(distPath) {
  const root = path.resolve(distPath);
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    let requested;
    try {
      requested = decodeURIComponent((request.url || '/').split('?')[0]);
    } catch {
      requested = '/';
    }
    if (requested === '/') requested = '/index.html';
    let file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile())
      file = path.join(root, 'index.html');
    try {
      const isIndex = path.basename(file) === 'index.html';
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': isIndex ? 'no-store' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(file));
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
}

async function startLocalServer(distPath) {
  for (const port of [4269, 0]) {
    const result = await new Promise((resolve) => {
      const server = serverFor(distPath);
      server.once('error', () => resolve(null));
      server.listen(port, '127.0.0.1', () => {
        const selected = server.address().port;
        resolve({
          server,
          port: selected,
          origin: `http://localhost:${selected}`,
        });
      });
    });
    if (result) return result;
  }
  throw new Error('No local port is available');
}

module.exports = { startLocalServer };
