/**
 * Bootstrap CJS para execução do backend compilado (`dist/server.js`).
 * Necessário em ambientes que iniciam via CommonJS.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const serverPath = pathToFileURL(
  path.join(__dirname, 'dist', 'server.js')
).href;

// Usa import dinâmico para carregar módulo ESM a partir de contexto CJS.
import(serverPath).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
