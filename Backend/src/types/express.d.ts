/**
 * types/express.d.ts
 *
 * Extensão de tipos do Express para o backend SPI.
 *
 * O que este arquivo faz:
 *  - Adiciona a propriedade `userId: string` à interface `Request` do Express.
 *  - O campo é preenchido pelo middleware `ensureAuth` após verificação do token JWT.
 *  - Sem esta declaração, TypeScript emitiria erro ao acessar `req.userId` nos controllers.
 *
 * Por que augmentation e não cast?
 *  - Augmentation (`declare namespace Express`) é o padrão oficial do TypeScript para
 *    extender tipos de bibliotecas de terceiros sem modificar seus arquivos originais.
 *  - Usar `(req as any).userId` ou `req['userId']` contornaria a segurança de tipos.
 */
declare namespace Express {
  export interface Request {
    userId: string;
  }
}
