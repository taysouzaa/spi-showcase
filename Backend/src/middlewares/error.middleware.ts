/**
 * middlewares/error.middleware.ts
 *
 * Middleware global de tratamento de erros do backend SPI.
 *
 * O que este arquivo faz:
 *  - Captura todos os erros que chegam via `next(error)` ou lançados em handlers async.
 *  - Converte `AppError` (domínio) em resposta HTTP com o código definido pelo erro.
 *  - Converte `ZodError` (validação de entrada) em resposta 400 com detalhes dos issues.
 *  - Loga erros inesperados no console com método, rota e stack completa.
 *  - Responde com 500 para qualquer erro não categorizado.
 *
 * Por que centralizar o tratamento de erros?
 *  - Evita `try/catch` repetitivos em cada rota.
 *  - Garante formato consistente de resposta de erro para o frontend.
 *  - Facilita adicionar rastreamento (ex.: Sentry) em um único ponto.
 *
 * IMPORTANTE: Este middleware deve ser registrado APÓS todas as rotas no app.ts.
 *  O Express reconhece um middleware de erro pela assinatura de 4 parâmetros (error, req, res, next).
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError.js';

/**
 * Handler de erros global. Formato da resposta: `{ message, error, issues? }`.
 *
 * @param error Erro capturado no pipeline Express.
 * @param req Requisição original (usada para logging de método/rota).
 * @param res Resposta HTTP.
 * @param next Próximo middleware — não utilizado, mas obrigatório na assinatura de 4 parâmetros.
 */
export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // ─── Erros de domínio (AppError) ──────────────────────────────────────────────
  // São erros esperados: autenticação, validação de negócio, recursos não encontrados, etc.
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      error: error.message
    });
  }

  // ─── Erros de validação de entrada (Zod) ──────────────────────────────────────
  // Gerados por `.parse()` nos schemas; incluem detalhes de cada campo inválido.
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      error: 'Validation failed',
      issues: error.issues
    });
  }

  // ─── Erros inesperados ─────────────────────────────────────────────────────────
  // Qualquer exceção não categorizada é logada e retorna 500 genérico.
  // O stack trace fica no servidor e não é exposto ao cliente por segurança.
  console.error(
    `[error] ${req.method} ${req.originalUrl}`,
    error instanceof Error ? error.message : 'Unknown error'
  );

  return res.status(500).json({
    message: 'Internal server error',
    error: 'Internal server error'
  });
}
