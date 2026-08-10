/**
 * modules/process/ProcessService.ts
 *
 * Serviço de processamento de payloads da SPI.
 *
 * O que este arquivo faz:
 *  - Valida o payload recebido usando o schema discriminado (`processInputSchema`).
 *  - Roteia para o handler correto conforme o `type` do payload.
 *  - Retorna resposta padronizada com `id` (UUID), `status`, `result` e `processedAt`.
 *
 * Tipos suportados:
 *  - `image`       → normaliza o nome do arquivo processado.
 *  - `marketplace` → valida e repete dados de marketplace/SKU.
 *  - `automation`  → prepara payload para orquestradores externos (ex.: n8n).
 *
 * Como adicionar um novo tipo:
 *  1. Adicione o schema em `Process.ts` na `discriminatedUnion`.
 *  2. Adicione o case no `switch` abaixo com o método de processamento correspondente.
 */
import { randomUUID } from 'crypto';
import {
  AutomationPayload,
  ImagePayload,
  MarketplacePayload,
  ProcessResult,
  processInputSchema,
} from './Process.js';
import { AppError } from '../../shared/errors/AppError.js';

export class ProcessService {
  /**
   * Valida e executa o fluxo de processamento conforme o tipo.
   *
   * @param input Payload bruto recebido da API (tipo `unknown` — validação feita internamente).
   * @returns Resultado estruturado com UUID, status, dados e timestamp.
   */
  async execute(input: unknown): Promise<ProcessResult> {
    const parsed = processInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('Invalid process payload', 400);
    }

    const data = parsed.data;
    let result: Record<string, unknown>;

    // Seleciona o método de negócio conforme o discriminador do payload.
    switch (data.type) {
      case 'image':
        result = this.processImage(data.payload);
        break;

      case 'marketplace':
        result = this.processMarketplace(data.payload);
        break;

      case 'automation':
        result = this.processAutomation(data.payload);
        break;

      default:
        throw new AppError('Unsupported process type', 400);
    }

    return {
      id: randomUUID(),
      status: 'success',
      result,
      processedAt: new Date()
    };
  }

  // ─── Handlers por tipo ─────────────────────────────────────────────────────

  /**
   * Processa payload de imagem: normaliza e formata o nome do arquivo.
   * @param payload Dados de imagem (opcional: `filename`).
   * @returns Metadados com nome original e nome processado.
   */
  private processImage(payload: ImagePayload) {
    const filename =
      typeof payload.filename === 'string' && payload.filename.trim()
        ? payload.filename.trim()
        : 'imagem';

    return {
      message: 'Image processed',
      original: filename,
      processedName: `processada_${filename}`
    };
  }

  /**
   * Valida e retorna dados de marketplace/SKU.
   * @param payload Dados comerciais (marketplace + SKU).
   * @returns Dados validados com status.
   */
  private processMarketplace(payload: MarketplacePayload) {
    return {
      marketplace: payload.marketplace,
      sku: payload.sku,
      status: 'validated'
    };
  }

  /**
   * Prepara payload para automações externas (ex.: n8n, Zapier).
   * @param payload Dados de automação (qualquer estrutura aceita).
   * @returns Payload envolto em estrutura de orquestramento.
   */
  private processAutomation(payload: AutomationPayload) {
    return {
      automation: 'ready_for_n8n',
      data: payload
    };
  }
}
