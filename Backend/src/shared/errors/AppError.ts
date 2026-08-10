/**
 * shared/errors/AppError.ts
 *
 * Classe de erro de domínio da aplicação SPI.
 *
 * O que este arquivo faz:
 *  - Define `AppError`, uma subclasse de `Error` que carrega um `statusCode` HTTP.
 *  - Permite que qualquer camada (serviço, controlador, repositório) lance erros tipados
 *    que o `errorMiddleware` converte diretamente em resposta HTTP adequada.
 *
 * Por que não usar `Error` diretamente?
 *  - `Error` não tem `statusCode`, então o middleware precisaria inferir o código HTTP
 *    a partir da mensagem — frágil e propenso a erros.
 *  - `AppError` torna a intenção explícita: `throw new AppError('Não encontrado', 404)`
 *    documenta a resposta esperada no ponto onde o erro é lançado.
 *
 * Uso:
 *  throw new AppError('Usuário não encontrado', 404);
 *  throw new AppError('Credenciais inválidas', 401);
 *  throw new AppError('Pasta do Drive não configurada', 400);
 */
export class AppError extends Error {
  public readonly statusCode: number;

  /**
   * @param message Mensagem legível da falha (retornada na resposta HTTP).
   * @param statusCode Código HTTP associado ao erro (padrão: 400).
   */
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
