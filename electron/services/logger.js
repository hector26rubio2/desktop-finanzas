const fs = require('fs');
const path = require('path');

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LINE_LENGTH = 16_384;
const LOG_GENERATIONS = 3;

function createLogger(app) {
  const sanitize = (value) =>
    String(value)
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(
        /("?(?:amount|description|password|passphrase|recoveryCode|token|resumeToken|payload|key)"?\s*[:=]\s*)[^,}\s]+/gi,
        '$1[REDACTED]',
      )
      .slice(0, MAX_LINE_LENGTH);

  function rotate(file) {
    if (!fs.existsSync(file) || fs.statSync(file).size < MAX_LOG_BYTES) return;
    const oldest = `${file}.${LOG_GENERATIONS}`;
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
    for (let generation = LOG_GENERATIONS - 1; generation >= 1; generation--) {
      const from = `${file}.${generation}`;
      if (fs.existsSync(from)) fs.renameSync(from, `${file}.${generation + 1}`);
    }
    fs.renameSync(file, `${file}.1`);
  }

  function write(prefix, message, args = []) {
    const line = `${new Date().toISOString()} ${prefix} ${sanitize(message)}${args.length ? ` ${args.map(sanitize).join(' ')}` : ''}\n`;
    process.stdout.write(line);
    try {
      const directory = path.join(app.getPath('userData'), 'logs');
      const file = path.join(directory, 'main.log');
      fs.mkdirSync(directory, { recursive: true });
      rotate(file);
      fs.appendFileSync(file, line, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Logging must never crash the financial workflow.
    }
  }
  function serialize(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return '[UNSERIALIZABLE]';
    }
  }
  return {
    info: (message, ...args) => write('[main]', message, args),
    warn: (message, ...args) => write('[WARN]', message, args),
    error: (message, ...args) => write('[ERR]', message, args),
    renderer: (level, message, data) =>
      write(`[render:${level}]`, message, data === undefined ? [] : [serialize(data)]),
    close: () => undefined,
  };
}

module.exports = { createLogger, MAX_LOG_BYTES, MAX_LINE_LENGTH, LOG_GENERATIONS };
