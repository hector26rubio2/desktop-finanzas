const fs = require('fs');
const path = require('path');

function createLogger(app) {
  let stream;
  const sanitize = (value) => String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/("?(?:amount|description|password|token|payload)"?\s*[:=]\s*)[^,}\s]+/gi, '$1[REDACTED]');
  function write(prefix, message, args = []) {
    const line = `${new Date().toISOString()} ${prefix} ${sanitize(message)}${args.length ? ` ${args.map(sanitize).join(' ')}` : ''}\n`;
    process.stdout.write(line);
    try {
      if (!stream) {
        const directory = path.join(app.getPath('userData'), 'logs');
        fs.mkdirSync(directory, { recursive: true });
        stream = fs.createWriteStream(path.join(directory, 'main.log'), { flags: 'a' });
      }
      stream.write(line);
    } catch (_) { /* logging must never crash the app */ }
  }
  return {
    info: (message, ...args) => write('[main]', message, args),
    error: (message, ...args) => write('[ERR]', message, args),
    renderer: (level, message, data) => write(`[render:${level}]`, message, data === undefined ? [] : [JSON.stringify(data)]),
    close: () => stream?.end(),
  };
}

module.exports = { createLogger };
