/**
 * auth.test.ts — Testes unitários do AuthService (autenticação por e-mail + telefone)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.NODE_ENV = 'test';

const { mockFindByEmail, mockFindById, mockCreate } = vi.hoisted(() => ({
  mockFindByEmail: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../modules/users/UserRepository.js', () => {
  class UserRepository {
    findByEmail = mockFindByEmail;
    findById = mockFindById;
    create = mockCreate;
  }
  return { UserRepository };
});

vi.mock('../database/prisma.js', () => ({
  prisma: {},
}));

import { AuthService } from '../modules/auth/AuthService.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe('register', () => {
    it('deve criar usuário com sucesso', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: 'uuid-1',
        name: 'João',
        email: 'joao@test.com',
        phone: '11999999999',
        marketplace: 'amazon',
      });

      const result = await service.register('João', 'joao@test.com', '11999999999', 'amazon');

      expect(result).toMatchObject({ id: 'uuid-1', name: 'João', email: 'joao@test.com' });
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('deve lançar 409 se e-mail já existe', async () => {
      mockFindByEmail.mockResolvedValue({ id: 'uuid-1', email: 'joao@test.com' });

      await expect(
        service.register('João', 'joao@test.com', '11999999999', 'amazon')
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('deve lançar 503 se banco estiver indisponível', async () => {
      mockFindByEmail.mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.register('João', 'joao@test.com', '11999999999', 'amazon')
      ).rejects.toMatchObject({ statusCode: 503 });
    });
  });

  describe('login', () => {
    it('deve retornar tokens para credenciais válidas', async () => {
      mockFindByEmail.mockResolvedValue({
        id: 'uuid-1',
        name: 'João',
        email: 'joao@test.com',
        phone: '11999999999',
        marketplace: 'amazon',
        isAdmin: false,
      });

      const result = await service.login('joao@test.com', '11999999999');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('joao@test.com');
    });

    it('deve lançar 401 para telefone incorreto', async () => {
      mockFindByEmail.mockResolvedValue({
        id: 'uuid-1',
        email: 'joao@test.com',
        phone: '11999999999',
        isAdmin: false,
      });

      await expect(
        service.login('joao@test.com', '11000000000')
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('deve lançar 401 para e-mail inexistente', async () => {
      mockFindByEmail.mockResolvedValue(null);

      await expect(
        service.login('nao@existe.com', '11999999999')
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
