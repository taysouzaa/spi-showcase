import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { S3Service } from '../images/S3Service.js';

export class HistoryController {
  // GET /history?marketplace=amazon&search=produto&dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=50
  list = async (req: Request, res: Response) => {
    const { marketplace, search, dateFrom, dateTo } = req.query;

    // ─── Paginação ────────────────────────────────────────────────────────────
    const rawPage  = parseInt(String(req.query.page  ?? '1'), 10);
    const rawLimit = parseInt(String(req.query.limit ?? '50'), 10);
    const page  = Number.isFinite(rawPage)  && rawPage  > 0 ? rawPage  : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
    const skip  = (page - 1) * limit;

    // ─── Filtros ──────────────────────────────────────────────────────────────
    const where: Prisma.ProcessedImageWhereInput = { userId: req.userId };

    if (marketplace && typeof marketplace === 'string') {
      where.marketplace = marketplace;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { finalName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(String(dateFrom));
      if (dateTo) {
        const to = new Date(String(dateTo));
        to.setHours(23, 59, 59, 999);
        (where.createdAt as Prisma.DateTimeFilter).lte = to;
      }
    }

    // ─── Query principal ──────────────────────────────────────────────────────
    const [rows, total] = await Promise.all([
      prisma.processedImage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.processedImage.count({ where }),
    ]);

    const s3 = new S3Service();

    const items = await Promise.all(
      rows.map(async (item) => {
        let displayUrl: string | null = null;
        if (item.s3Key) {
          try {
            // 1h TTL — short enough to stay fresh, long enough not to expire during browsing
            displayUrl = await s3.getPresignedUrl(item.s3Key, { expiresIn: 3600 });
          } catch {
            displayUrl = item.s3Url;
          }
        }
        return {
          id: item.id,
          fileName: item.fileName,
          finalName: item.finalName,
          marketplace: item.marketplace,
          width: item.width,
          height: item.height,
          createdAt: item.createdAt,
          s3Key: item.s3Key,
          s3Url: item.s3Url,
          displayUrl,
        };
      })
    );

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  };

  remove = async (req: Request, res: Response) => {
    const imageId = req.params.id;

    const result = await prisma.processedImage.deleteMany({
      where: { id: imageId, userId: req.userId },
    });

    if (result.count === 0) throw new AppError('Imagem nao encontrada', 404);
    return res.status(204).send();
  };

  clear = async (req: Request, res: Response) => {
    const result = await prisma.processedImage.deleteMany({ where: { userId: req.userId } });
    return res.json({ deleted: result.count });
  };

  downloadUrl = async (req: Request, res: Response) => {
    const imageId = req.params.id;

    const image = await prisma.processedImage.findFirst({
      where: { id: imageId, userId: req.userId },
      select: { s3Key: true, finalName: true },
    });

    if (!image) throw new AppError('Imagem não encontrada', 404);
    if (!image.s3Key) throw new AppError('Imagem sem chave S3', 404);

    const s3 = new S3Service();
    const url = await s3.getPresignedUrl(image.s3Key, { fileName: image.finalName ?? undefined });

    return res.json({ url });
  };
}
