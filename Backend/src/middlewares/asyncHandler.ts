/**
 * middlewares/asyncHandler.ts
 *
 * Wrapper para handlers de rota assíncronos do Express.
 *
 * O que este arquivo faz:
 *  - Envolve a função handler em uma Promise.resolve para capturar rejeições.
 *  - Encaminha erros para o pipeline de erros do Express via `next(error)`.
 *
 * Por que isso é necessário?
 *  - O Express 4 não captura exceções em funções async automaticamente.
 *    Sem esse wrapper, um `throw` dentro de um handler async deixa a requisição pendurada
 *    ou derruba o processo.
 *  - Com `asyncHandler`, basta lançar `throw new AppError(...)` em qualquer handler
 *    que o `errorMiddleware` recebe e formata a resposta corretamente.
 *
 * Uso:
 *  router.get('/rota', asyncHandler(async (req, res) => {
 *    const data = await algumServico();
 *    return res.json(data);
 *  }));
 */
import { Request, Response, NextFunction } from 'express';

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

/**
 * Envolve um handler assíncrono para capturar erros e repassá-los ao Express.
 *
 * @param handler Função de rota assíncrona.
 * @returns Middleware Express com tratamento automático de rejeições.
 */
export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Promise.resolve garante captura mesmo de handlers síncronos que lançam exceção.
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
