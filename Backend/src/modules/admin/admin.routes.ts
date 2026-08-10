import { Router } from 'express';
import { AdminController } from './AdminController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { ensureAdmin } from '../../middlewares/ensureAdmin.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const controller = new AdminController();

router.use(ensureAuth, ensureAdmin);

router.get('/users', asyncHandler(controller.listUsers));
router.post('/users', asyncHandler(controller.createUser));
router.patch('/users/:id/block', asyncHandler(controller.toggleBlock));
router.delete('/users/:id', asyncHandler(controller.deleteUser));
router.get('/stats', asyncHandler(controller.stats));

export default router;
