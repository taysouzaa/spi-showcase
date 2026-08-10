import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../shared/errors/AppError.js';
import { getJwtSecret } from '../config/jwt.js';
import { prisma } from '../database/prisma.js';

interface TokenPayload {
  sub?: string;
  type?: 'access' | 'refresh';
}

function parseCookie(header: string | undefined, name: string): string {
  if (!header) return '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export async function ensureAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    // Aceita token via cookie httpOnly (preferencial) ou Authorization header (fallback/API).
    const cookieToken = parseCookie(req.headers.cookie, 'accessToken');
    const authHeader  = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = cookieToken || bearerToken;

    if (!token) return next(new AppError('Token missing', 401));

    let userId: string;

    try {
      const decoded = jwt.verify(token, getJwtSecret(), { clockTolerance: 5 }) as TokenPayload;
      if (!decoded?.sub || (decoded.type && decoded.type !== 'access')) {
        return next(new AppError('Invalid token', 401));
      }
      userId = decoded.sub;
    } catch (error) {
      if (error instanceof AppError) return next(error);
      if (error instanceof jwt.TokenExpiredError) return next(new AppError('Token expired', 401));
      return next(new AppError('Invalid token', 401));
    }

    // Verifica se o usuário está bloqueado.
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
      if (user?.isBlocked) {
        return next(new AppError('Conta bloqueada. Entre em contato com o suporte.', 403));
      }
    } catch {
      // Banco indisponível: rejeita a requisição para não permitir usuários bloqueados passarem.
      return next(new AppError('Serviço temporariamente indisponível. Tente novamente em instantes.', 503));
    }

    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
