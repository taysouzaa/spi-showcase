/**
 * modules/auth/AuthController.ts
 *
 * Controller HTTP do módulo de autenticação da SPI.
 *
 * Endpoints:
 *  - POST /auth/register → cadastro com nome, telefone, e-mail e marketplace.
 *  - POST /auth/login    → acesso com e-mail + telefone.
 *  - POST /auth/refresh  → renovação de tokens.
 */
import { Request, Response } from 'express';
import { AuthService } from './AuthService.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';
import { AppError } from '../../shared/errors/AppError.js';

function parseCookie(header: string | undefined, name: string): string {
  if (!header) return '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

const ACCESS_MAX_AGE  = 15 * 60 * 1000;           // 15 min em ms
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias em ms

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const };
  res.cookie('accessToken',  accessToken,  { ...base, maxAge: ACCESS_MAX_AGE,  path: '/' });
  res.cookie('refreshToken', refreshToken, { ...base, maxAge: REFRESH_MAX_AGE, path: '/' });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken',  { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

export class AuthController {
  private service = new AuthService();

  // ─── Register ────────────────────────────────────────────────────────────────

  /**
   * Cadastra novo usuário.
   * @param req Corpo: `{ name, phone, confirmPhone, email, marketplace }`.
   * @param res Retorna `201` com `{ id, name, email, phone, marketplace }`.
   */
  register = async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);

    const user = await this.service.register(
      data.name,
      data.email,
      data.phone,
      data.marketplace,
    );

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      marketplace: user.marketplace,
    });
  };

  // ─── Login ───────────────────────────────────────────────────────────────────

  /**
   * Autentica usuário e retorna par de tokens (access + refresh).
   * @param req Corpo: `{ email, phone }`.
   * @param res Retorna `{ token, accessToken, refreshToken, tokenType, expiresIn, user }`.
   */
  login = async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const payload = await this.service.login(data.email, data.phone);

    setAuthCookies(res, payload.accessToken, payload.refreshToken);

    // Retorna apenas dados públicos — tokens trafegam somente via cookie httpOnly.
    return res.json({ tokenType: payload.tokenType, expiresIn: payload.expiresIn, user: payload.user });
  };

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  /**
   * Renova tokens a partir de um refresh token válido.
   * Aceita o token tanto no corpo (`refreshToken`) quanto no cabeçalho `Authorization: Bearer`.
   */
  refresh = async (req: Request, res: Response) => {
    // Aceita o refresh token em três fontes, em ordem de prioridade:
    // 1. Cookie httpOnly (método preferencial)
    // 2. Corpo da requisição (fallback para clientes sem cookies)
    // 3. Header Authorization: Bearer (compatibilidade legado)
    const cookieToken = parseCookie(req.headers.cookie, 'refreshToken');
    const bodyToken   = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    const authHeader  = req.headers.authorization;
    const headerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim() : '';

    const refreshToken = cookieToken || bodyToken || headerToken;

    if (!refreshToken) {
      throw new AppError('Refresh token missing', 401);
    }

    const data = refreshSchema.parse({ refreshToken });
    const payload = await this.service.refresh(data.refreshToken);

    setAuthCookies(res, payload.accessToken, payload.refreshToken);

    return res.json({ tokenType: payload.tokenType, expiresIn: payload.expiresIn, user: payload.user });
  };

  // ─── Logout ──────────────────────────────────────────────────────────────────

  logout = (_req: Request, res: Response) => {
    clearAuthCookies(res);
    return res.status(204).send();
  };
}
