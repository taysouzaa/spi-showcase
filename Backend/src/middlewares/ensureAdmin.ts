import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError.js';
import { prisma } from '../database/prisma.js';

export async function ensureAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return next(new AppError('Não autenticado', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return next(new AppError('Acesso restrito a administradores', 403));
    }

    next();
  } catch (error) {
    next(error);
  }
}
