/**
 * parseEnv.ts
 *
 * Utilitários para leitura segura de variáveis de ambiente.
 */

/**
 * Lê uma variável de ambiente e retorna um inteiro positivo.
 * Se o valor for inválido, ausente ou não-positivo, retorna o `fallback`.
 *
 * @param raw   Valor bruto da variável de ambiente (ex: process.env.PORT).
 * @param fallback Valor padrão caso `raw` seja inválido.
 * @returns Inteiro positivo ou `fallback`.
 */
export function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
