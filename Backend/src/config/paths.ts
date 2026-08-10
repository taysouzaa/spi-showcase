/**
 * config/paths.ts
 *
 * Resolução centralizada de diretórios do backend SPI.
 *
 * O que este arquivo faz:
 *  - Detecta se o processo roda em ambiente serverless (Vercel, Lambda, Azure Functions).
 *  - Define o diretório de uploads usando, em ordem de prioridade:
 *      1. Variável UPLOADS_DIR (configuração explícita).
 *      2. Pasta temporária do SO em ambientes serverless (somente gravável em `/tmp`).
 *      3. `./uploads` relativo à raiz do projeto em ambientes tradicionais.
 *
 * Por que isso importa?
 *  - Em Vercel/Lambda o sistema de arquivos é somente leitura exceto em `/tmp`.
 *    Tentar gravar em `./uploads` causaria erro silencioso ou exceção de permissão.
 *  - A detecção automática evita configuração extra no deploy serverless.
 */
import path from 'node:path';
import os from 'node:os';

// ─── Detecção de ambiente ──────────────────────────────────────────────────────

// Fallback em cascata para o diretório temporário do SO — compatível com Linux, macOS e Windows.
const tmpBase =
  process.env.TMPDIR || process.env.TEMP || process.env.TMP || os.tmpdir();

// Variáveis de ambiente injetadas automaticamente por cada plataforma serverless conhecida.
const isServerless = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTIONS_WORKER_RUNTIME  // Azure Functions
);

// ─── Diretório de uploads ──────────────────────────────────────────────────────

// Caminho padrão para ambientes com sistema de arquivos persistente (VPS, servidor dedicado).
const defaultUploadsDir = path.resolve('uploads');

/**
 * Diretório final onde os uploads são salvos.
 *
 * Prioridade:
 *  1. `UPLOADS_DIR` definido manualmente.
 *  2. `/tmp/uploads` em serverless (único local gravável).
 *  3. `./uploads` em ambiente convencional.
 */
export const uploadsDir =
  process.env.UPLOADS_DIR?.trim() ||
  (isServerless ? path.join(tmpBase, 'uploads') : defaultUploadsDir);
