import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import processRoutes from '../modules/process/process.routes.js';
import historyRoutes from '../modules/history/history.routes.js';
import imageRoutes from '../modules/images/images.routes.js';
import leadsRoutes from '../modules/leads/leads.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import { prisma } from '../database/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const routes = Router();

routes.get('/health', asyncHandler(async (_req, res) => {
  let db = 'ok';
  try { await prisma.$queryRaw`SELECT 1`; } catch { db = 'unavailable'; }
  return res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
}));

routes.use('/auth', authRoutes);
routes.use('/users', userRoutes);
routes.use('/process', processRoutes);
routes.use('/history', historyRoutes);
routes.use('/images', imageRoutes);
routes.use('/leads', leadsRoutes);
routes.use('/admin', adminRoutes);

export default routes;
