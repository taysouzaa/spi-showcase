/**
 * modules/users/user.routes.ts
 *
 * Rotas do módulo de usuário autenticado.
 *
 * O que este arquivo faz:
 *  - Define o endpoint para consulta dos dados do usuário logado.
 *  - Protege a rota com `ensureAuth` (exige token Bearer válido).
 *
 * Endpoints:
 *  GET /users/me  → retorna `{ id, name, email, createdAt }` do usuário autenticado.
 */
import { Router } from 'express';
import { UserController } from './UserController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new UserController();

// `ensureAuth` injeta `req.userId`; o controller usa para buscar o usuário correto no banco.
router.get('/me', ensureAuth, asyncHandler(controller.me));

export default router;
