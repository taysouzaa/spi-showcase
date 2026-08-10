/**
 * modules/leads/leads.routes.ts
 *
 * POST /leads  → público (landing page).
 * GET  /leads  → requer auth (painel admin).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LeadsController } from './LeadsController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { ensureAdmin } from '../../middlewares/ensureAdmin.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new LeadsController();

const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro de interesse. Tente novamente mais tarde.' },
});

router.post('/', leadsLimiter, asyncHandler(controller.create));
router.get('/', ensureAuth, ensureAdmin, asyncHandler(controller.list));

export default router;
