/**
 * modules/process/ProcessController.ts
 *
 * Controller do módulo de processamento genérico.
 *
 * O que este arquivo faz:
 *  - Recebe o payload da requisição e o encaminha ao `ProcessService`.
 *  - Retorna o resultado estruturado com `id`, `status`, `result` e `processedAt`.
 *  - A validação do payload acontece no `ProcessService` via Zod (lança 400 se inválido).
 */
import { Request, Response } from 'express';
import { ProcessService } from './ProcessService.js';

export class ProcessController {
  private service = new ProcessService();

  /**
   * Executa um processo conforme o `type` recebido no corpo.
   *
   * @param req Corpo da requisição com `{ type, payload }`.
   * @param res Resposta com resultado do processamento.
   * @returns `{ id, status, result, processedAt }`.
   */
  execute = async (req: Request, res: Response) => {
    const result = await this.service.execute(req.body);
    return res.json(result);
  };
}
