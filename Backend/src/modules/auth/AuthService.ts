/**
 * modules/auth/AuthService.ts
 *
 * Serviço de autenticação do backend SPI.
 *
 * Autenticação sem senha: o usuário se identifica com e-mail + telefone.
 *  - Cadastro: persiste nome, e-mail, telefone normalizado e marketplace.
 *  - Login: localiza usuário pelo e-mail e verifica se o telefone confere.
 *  - Refresh: rotação de tokens JWT (access + refresh).
 */
import jwt from 'jsonwebtoken';
import { UserRepository } from '../users/UserRepository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { getJwtRefreshSecret, getJwtSecret } from '../../config/jwt.js';
import { normalizePhone } from './auth.schema.js';

// ─── Tipos internos ────────────────────────────────────────────────────────────

type TokenPayload = {
  sub?: string;
  type?: 'access' | 'refresh';
};

// ─── Configuração de TTL ───────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_EXPIRES_IN?.trim() ||
  '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_TOKEN_TTL = (process.env.JWT_REFRESH_EXPIRES_IN?.trim() ||
  '30d') as jwt.SignOptions['expiresIn'];

// ─── Serviço ───────────────────────────────────────────────────────────────────

export class AuthService {
  private usersRepository = new UserRepository();
  private accessTokenSecret = getJwtSecret();
  private refreshTokenSecret = getJwtRefreshSecret();

  // ─── Register ──────────────────────────────────────────────────────────────

  /**
   * Cadastra novo usuário com e-mail, telefone (normalizado) e marketplace.
   * Falha com 409 se o e-mail já estiver em uso; 503 se o banco estiver indisponível.
   */
  async register(name: string, email: string, phone: string, marketplace: string) {
    let userExists = null;
    try {
      userExists = await this.usersRepository.findByEmail(email);
    } catch {
      throw new AppError('Database unavailable', 503);
    }

    if (userExists) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const user = await this.usersRepository.create({
      name,
      email,
      phone: normalizePhone(phone),
      marketplace,
    });

    return user;
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  /**
   * Valida e-mail + telefone e emite par de tokens JWT.
   * Usa a mesma mensagem genérica para os dois casos de falha para não revelar
   * se o e-mail está cadastrado (prevenção de enumeração).
   */
  async login(email: string, phone: string) {
    let user = null;
    try {
      user = await this.usersRepository.findByEmail(email);
    } catch {
      throw new AppError('Database unavailable', 503);
    }

    if (!user) {
      throw new AppError('Credenciais inválidas', 401);
    }

    if (user.phone !== normalizePhone(phone)) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const accessToken = this.signAccessToken(user.id);
    const refreshToken = this.signRefreshToken(user.id);

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        marketplace: user.marketplace,
        isAdmin: user.isAdmin,
      },
    };
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────

  /**
   * Renova a sessão a partir de refresh token válido (rotação de tokens).
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new AppError('Refresh token missing', 401);
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, this.refreshTokenSecret, {
        clockTolerance: 5,
      }) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401);
      }
      throw new AppError('Invalid refresh token', 401);
    }

    const userId = payload.sub;
    if (!userId || payload.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    let user = null;
    try {
      user = await this.usersRepository.findById(userId);
    } catch {
      throw new AppError('Database unavailable', 503);
    }

    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    const nextAccessToken = this.signAccessToken(user.id);
    const nextRefreshToken = this.signRefreshToken(user.id);

    return {
      token: nextAccessToken,
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        marketplace: user.marketplace,
        isAdmin: user.isAdmin,
      },
    };
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private signAccessToken(userId: string) {
    return jwt.sign(
      { sub: userId, type: 'access' },
      this.accessTokenSecret,
      { expiresIn: ACCESS_TOKEN_TTL }
    );
  }

  private signRefreshToken(userId: string) {
    return jwt.sign(
      { sub: userId, type: 'refresh' },
      this.refreshTokenSecret,
      { expiresIn: REFRESH_TOKEN_TTL }
    );
  }
}
