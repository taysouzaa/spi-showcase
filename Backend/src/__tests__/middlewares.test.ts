/**
 * middlewares.test.ts — Testes unitários dos middlewares de autenticação
 *
 * Observação sobre o design do ensureAuth:
 *  - A função é síncrona para os casos de erro imediato (sem token, formato inválido).
 *  - Para verificação de bloqueio no banco, ela usa .then()/.catch() internamente.
 *  - Portanto alguns testes precisam aguardar a resolução da promise interna via
 *    setImmediate/flushPromises para que next() seja chamado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.NODE_ENV = 'test';

// Mock do Prisma antes de importar o middleware
vi.mock('../database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Helpers para criar objetos Express fake
const makeReq = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
  userId: undefined as unknown as string,
});

const makeRes = (): Partial<Response> => ({
  status: vi.fn().mockReturnThis() as unknown as Response['status'],
  json: vi.fn().mockReturnThis() as unknown as Response['json'],
});

const makeNext = (): NextFunction => vi.fn();

/** Aguarda microtasks e I/O pendentes para que .then() do middleware resolva */
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('ensureAuth middleware', () => {
  // Importa de forma lazy para garantir que o mock já está registrado
  let ensureAuth: (req: Request, res: Response, next: NextFunction) => void;
  let mockFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-importa para obter referência atualizada com mocks limpos
    const mod = await import('../middlewares/auth.middleware.js');
    ensureAuth = mod.ensureAuth;
    const { prisma } = await import('../database/prisma.js');
    mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
  });

  it('deve chamar next() com token válido e usuário não bloqueado', async () => {
    const token = jwt.sign(
      { sub: 'user-1', type: 'access' },
      'test-secret-key-for-unit-tests'
    );
    mockFindUnique.mockResolvedValue({ id: 'user-1', isBlocked: false });

    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = makeNext();

    ensureAuth(req as Request, res as Response, next);
    await flushPromises();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // chamado sem argumento = sem erro
    expect((req as Request & { userId: string }).userId).toBe('user-1');
  });

  it('deve chamar next com AppError 401 quando não há token', async () => {
    const req = makeReq({});
    const res = makeRes();
    const next = makeNext();

    await ensureAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('deve chamar next com AppError 401 para token inválido', async () => {
    const req = makeReq({ authorization: 'Bearer token.invalido.aqui' });
    const res = makeRes();
    const next = makeNext();

    await ensureAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('deve chamar next(AppError 403) para usuário bloqueado', async () => {
    const token = jwt.sign(
      { sub: 'user-blocked', type: 'access' },
      'test-secret-key-for-unit-tests'
    );
    mockFindUnique.mockResolvedValue({ id: 'user-blocked', isBlocked: true });

    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = makeNext();

    ensureAuth(req as Request, res as Response, next);
    await flushPromises();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('deve rejeitar com 503 quando o banco está indisponível (fail-closed)', async () => {
    const token = jwt.sign(
      { sub: 'user-db-fail', type: 'access' },
      'test-secret-key-for-unit-tests'
    );
    mockFindUnique.mockRejectedValue(new Error('DB unreachable'));

    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = makeNext();

    await ensureAuth(req as Request, res as Response, next);
    await flushPromises();

    // Rejeita de propósito: deixar passar permitiria que um usuário bloqueado
    // entrasse sempre que o banco oscilasse.
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
  });
});
