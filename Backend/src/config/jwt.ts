/**
 * config/jwt.ts
 *
 * Resolução de segredos JWT do backend SPI.
 *
 * O que este arquivo faz:
 *  - Lê JWT_SECRET e JWT_REFRESH_SECRET das variáveis de ambiente.
 *  - Em desenvolvimento, usa fallback fixo quando as variáveis não estão definidas
 *    e emite aviso no console (uma única vez por processo).
 *  - Em produção, lança erro imediato se JWT_SECRET não estiver configurado,
 *    impedindo o servidor de subir com segurança nula.
 *
 * Por que fallback apenas em desenvolvimento?
 *  - Facilita o primeiro setup sem precisar configurar .env.
 *  - Em produção, tokens assinados com segredo padrão seriam trivialmente forjáveis.
 *
 * Como usar:
 *  - `getJwtSecret()` → para assinar/verificar access tokens.
 *  - `getJwtRefreshSecret()` → para assinar/verificar refresh tokens
 *    (usa segredo dedicado se disponível; caso contrário, reutiliza o principal).
 */
import { AppError } from '../shared/errors/AppError.js';

// Flag para emitir aviso de fallback apenas uma vez no ciclo de vida do processo.
let hasWarnedDevFallback = false;

// ─── Utilitários internos ──────────────────────────────────────────────────────

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Lê variável de ambiente removendo espaços extras.
 * @param name Nome da variável.
 * @returns Valor sanitizado ou `undefined` quando ausente/vazio.
 */
function readEnv(name: string) {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function warnDevFallback(message: string) {
  if (hasWarnedDevFallback) return;
  hasWarnedDevFallback = true;
  console.warn(message);
}

/**
 * Resolve segredo JWT a partir da variável de ambiente.
 * Lança erro se a variável não estiver definida — sem fallback em nenhum ambiente.
 * @param envName Nome da variável no ambiente.
 * @returns Segredo resolvido.
 */
function resolveSecret(envName: string) {
  const value = readEnv(envName);
  if (value) return value;
  throw new AppError(
    `${envName} nao configurado. Defina a variável de ambiente antes de iniciar o servidor.`,
    500
  );
}

// ─── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Retorna o segredo para assinar/verificar access tokens.
 * @returns Segredo JWT resolvido.
 */
export function getJwtSecret() {
  return resolveSecret('JWT_SECRET');
}

/**
 * Retorna o segredo para assinar/verificar refresh tokens.
 * Usa JWT_REFRESH_SECRET quando disponível; caso contrário reutiliza o access secret.
 * Reutilizar o mesmo segredo é aceitável mas menos seguro — separá-los é preferível em produção.
 *
 * @returns Segredo de refresh token.
 */
export function getJwtRefreshSecret() {
  const refresh = readEnv('JWT_REFRESH_SECRET');
  if (refresh) return refresh;
  // In production both secrets must be distinct — sharing them weakens the rotation guarantee.
  if (isProductionEnv()) {
    throw new AppError(
      'JWT_REFRESH_SECRET nao configurado. Defina a variável de ambiente antes de iniciar o servidor.',
      500
    );
  }
  return getJwtSecret();
}
