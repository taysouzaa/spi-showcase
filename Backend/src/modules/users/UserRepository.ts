/**
 * modules/users/UserRepository.ts
 *
 * Repositório de acesso a dados de usuários.
 * Encapsula todas as operações de banco relacionadas à entidade `User`.
 */
import { prisma } from '../../database/prisma.js';

export class UserRepository {
  /** Busca usuário pelo e-mail. Retorna `null` se não encontrado. */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /** Busca usuário pelo ID primário. */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Cria um novo usuário no banco.
   * O telefone deve estar normalizado (somente dígitos) antes de chamar este método.
   */
  async create(data: {
    name: string;
    email: string;
    phone: string;
    marketplace?: string;
    isAdmin?: boolean;
  }) {
    return prisma.user.create({
      data,
    });
  }

  /** Atualiza campos de um usuário pelo ID. */
  async update(id: string, data: Partial<{ isAdmin: boolean; isBlocked: boolean }>) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}
