/**
 * modules/leads/LeadsController.ts
 *
 * Captura de leads da landing page.
 *
 * POST /leads  → salva email, nome e WhatsApp de visitantes interessados.
 * GET  /leads  → lista todos os leads (requer auth de admin).
 *
 * Usa upsert: se o mesmo email enviar o formulário duas vezes,
 * atualiza os dados em vez de duplicar.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

const LeadSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().max(120).optional(),
  whatsapp: z.string().max(20).optional(),
  source: z.string().max(60).optional(),
});

export class LeadsController {
  create = async (req: Request, res: Response) => {
    const parsed = LeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dados inválidos', 400);
    }

    const { email, name, whatsapp, source } = parsed.data;

    try {
      const lead = await prisma.lead.upsert({
        where: { email },
        update: { name, whatsapp },
        create: { email, name, whatsapp, source: source || 'landing-page' },
      });
      return res.status(201).json({ id: lead.id, email: lead.email });
    } catch {
      throw new AppError('Falha ao registrar interesse', 500);
    }
  };

  list = async (req: Request, res: Response) => {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, whatsapp: true, source: true, createdAt: true },
    });
    return res.json(leads);
  };
}
