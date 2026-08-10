/**
 * modules/process/Process.ts
 *
 * Tipos e schemas do domínio de processamento da SPI.
 *
 * O que este arquivo faz:
 *  - Define a estrutura de entrada para cada tipo de processo usando Zod (`discriminatedUnion`).
 *  - Exporta os tipos TypeScript inferidos dos schemas para uso no serviço e controller.
 *  - Define a interface `ProcessResult` que padroniza o formato de resposta da API.
 *
 * Tipos de processo suportados:
 *  - `image`       → processamento de arquivos de imagem (nome do arquivo).
 *  - `marketplace` → validação de dados de marketplace (canal de venda + SKU).
 *  - `automation`  → preparação de payload para orquestradores externos (ex.: n8n).
 *
 * Por que `discriminatedUnion`?
 *  - O Zod verifica o campo `type` primeiro e aplica o schema correto para o `payload`.
 *    Isso garante que cada tipo só receba os campos que fazem sentido para ele.
 *  - Payloads de tipos desconhecidos falham imediatamente com `ZodError`, retornando 400.
 */
import { z } from 'zod';

// ─── Schemas de payload por tipo ───────────────────────────────────────────────

// Base genérica: aceita qualquer campo adicional via `catchall` (extensível por tipo).
const basePayloadSchema = z.object({}).catchall(z.unknown());

// Payload para processamento de imagem: apenas o nome é relevante para o servidor.
export const imagePayloadSchema = basePayloadSchema.extend({
  filename: z.string().min(1).optional(),
});

// Payload de marketplace: canal de venda e SKU do produto.
export const marketplacePayloadSchema = basePayloadSchema.extend({
  marketplace: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
});

// Payload de automação: aceita qualquer estrutura (roteado a sistemas externos).
export const automationPayloadSchema = basePayloadSchema;

// ─── Schema de entrada unificado ───────────────────────────────────────────────

// União discriminada por `type`: o Zod só valida o `payload` correspondente ao tipo informado.
export const processInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    payload: imagePayloadSchema,
  }),
  z.object({
    type: z.literal('marketplace'),
    payload: marketplacePayloadSchema,
  }),
  z.object({
    type: z.literal('automation'),
    payload: automationPayloadSchema,
  }),
]);

// ─── Tipos exportados ──────────────────────────────────────────────────────────

export type ProcessInput = z.infer<typeof processInputSchema>;
export type ImagePayload = z.infer<typeof imagePayloadSchema>;
export type MarketplacePayload = z.infer<typeof marketplacePayloadSchema>;
export type AutomationPayload = z.infer<typeof automationPayloadSchema>;

// ─── Resultado padronizado ────────────────────────────────────────────────────

export interface ProcessResult {
  id: string;                       // UUID v4 gerado para rastreamento.
  status: 'success' | 'error';
  result: Record<string, unknown>;  // Dados específicos de cada tipo de processo.
  processedAt: Date;
}
