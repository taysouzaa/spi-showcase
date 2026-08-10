/**
 * modules/history/history.routes.ts
 *
 * Rotas do módulo de histórico de imagens processadas.
 *
 * O que este arquivo faz:
 *  - Define os endpoints para consulta e remoção do histórico do usuário autenticado.
 *  - Todas as rotas exigem autenticação via `ensureAuth`.
 *
 * Endpoints:
 *  GET    /history        → lista todas as imagens processadas pelo usuário.
 *  DELETE /history        → apaga todo o histórico do usuário (ação irreversível).
 *  DELETE /history/:id    → remove um item específico pelo ID.
 */
import { Router } from 'express';
import { HistoryController } from './HistoryController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new HistoryController();

router.get('/', ensureAuth, asyncHandler(controller.list));
router.get('/:id/download-url', ensureAuth, asyncHandler(controller.downloadUrl));
router.delete('/', ensureAuth, asyncHandler(controller.clear));
router.delete('/:id', ensureAuth, asyncHandler(controller.remove));

export default router;
