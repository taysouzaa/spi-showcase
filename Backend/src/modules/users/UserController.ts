/**
 * modules/users/UserController.ts
 *
 * Controller do módulo de usuário autenticado.
 * Fornece `GET /users/me` para o usuário consultar seus próprios dados.
 */
import { Request, Response } from 'express';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

export class UserController {
  me = async (req: Request, res: Response) => {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        marketplace: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return res.json(user);
  };
}
