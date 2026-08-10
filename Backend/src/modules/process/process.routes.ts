/**
 * modules/process/process.routes.ts
 *
 * Rotas do módulo de processamento genérico da SPI.
 *
 * O que este arquivo faz:
 *  - Define o endpoint de execução de processos por tipo (image, marketplace, automation).
 *  - Protege a rota com `ensureAuth` (requer usuário autenticado).
 *
 * Endpoints:
 *  POST /process/execute  → executa um processo conforme o `type` no corpo da requisição.
 *                           Corpo esperado: `{ type: 'image' | 'marketplace' | 'automation', payload: {...} }`.
 */
import { Router } from 'express';
import { ProcessController } from './ProcessController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new ProcessController();

router.post('/execute', ensureAuth, asyncHandler(controller.execute));

export default router;
