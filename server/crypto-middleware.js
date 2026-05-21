const { createCrypto } = require('./crypto');
const { buildChain } = require('./chain-of-responsibility');

// ── Factory ─────────────────────────────────────────────────────────
// Crea manejadores de la cadena (Chain of Responsibility).
function createHandlers(strategy) {
  return [
    {
      name: 'decrypt',
      handle(req, res, next) {
        if (req.body && typeof req.body === 'object' && req.body.encrypted) {
          try {
            req.body = strategy.decrypt(req.body.encrypted);
          } catch {
            return res.status(400).json({ error: 'Decryption failed' });
          }
        }
        next();
      },
    },
    {
      name: 'encrypt',
      handle(req, res, next) {
        const originalJson = res.json.bind(res);
        res.json = function (body) {
          if (body && typeof body === 'object' && !body.error) {
            try {
              return originalJson({ encrypted: strategy.encrypt(body) });
            } catch {
              return originalJson(body);
            }
          }
          return originalJson(body);
        };
        next();
      },
    },
  ];
}

// ── Proxy ───────────────────────────────────────────────────────────
// El middleware expuesto es un Proxy que delega en la cadena interna.
function encryptionMiddleware(passphrase) {
  const strategy = createCrypto(passphrase);
  const handlers = createHandlers(strategy);
  return buildChain(handlers);
}

module.exports = encryptionMiddleware;
