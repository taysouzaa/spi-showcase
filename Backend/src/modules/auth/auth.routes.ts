/**
 * modules/auth/auth.routes.ts
 *
 * Rotas públicas do módulo de autenticação.
 *
 * O que este arquivo faz:
 *  - Define os endpoints de registro de conta, login e renovação de token.
 *  - Todas as rotas são públicas (não requerem autenticação prévia).
 *  - Delega a lógica ao `AuthController`, que valida entrada e chama o `AuthService`.
 *
 * Endpoints:
 *  POST /register  → cria novo usuário com senha hasheada.
 *  POST /login     → valida credenciais e retorna par de tokens (access + refresh).
 *  POST /refresh   → renova tokens a partir de um refresh token válido.
 */
import { Router } from 'express';
import { AuthController } from './AuthController.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new AuthController();

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', controller.logout);

export default router;
