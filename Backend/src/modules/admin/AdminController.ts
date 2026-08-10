import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  marketplace: z.string().optional(),
});

export class AdminController {
  // GET /admin/users
  listUsers = async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        marketplace: true,
        isAdmin: true,
        isBlocked: true,
        createdAt: true,
        _count: { select: { images: true } },
      },
    });
    return res.json(users);
  };

  // POST /admin/users
  createUser = async (req: Request, res: Response) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0]?.message || 'Dados inválidos', 400);

    const { name, email, phone, marketplace } = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError('E-mail já cadastrado', 409);

    const user = await prisma.user.create({
      data: { name, email, phone: phone.replace(/\D/g, ''), marketplace },
      select: { id: true, name: true, email: true, phone: true, marketplace: true, createdAt: true },
    });
    return res.status(201).json(user);
  };

  // PATCH /admin/users/:id/block
  toggleBlock = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    if (user.isAdmin) throw new AppError('Não é possível bloquear um administrador', 403);

    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: { id: true, isBlocked: true },
    });
    return res.json(updated);
  };

  // DELETE /admin/users/:id
  deleteUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (id === req.userId) throw new AppError('Não é possível excluir sua própria conta', 403);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    if (user.isAdmin) throw new AppError('Não é possível excluir um administrador', 403);

    await prisma.processedImage.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  };

  // GET /admin/stats
  stats = async (_req: Request, res: Response) => {
    const [totalUsers, totalImages, totalLeads, imagesByMarketplace, recentUsers] =
      await Promise.all([
        prisma.user.count(),
        prisma.processedImage.count(),
        prisma.lead.count(),
        prisma.processedImage.groupBy({
          by: ['marketplace'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, email: true, createdAt: true, isBlocked: true },
        }),
      ]);

    return res.json({
      totalUsers,
      totalImages,
      totalLeads,
      imagesByMarketplace: imagesByMarketplace.map((g) => ({
        marketplace: g.marketplace,
        count: g._count.id,
      })),
      recentUsers,
    });
  };
}
