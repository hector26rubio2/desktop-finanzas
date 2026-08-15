const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  dialect: 'sqlite',
  schema: './electron/local-data/schema.js',
  out: './electron/local-data/migrations',
  strict: true,
});
