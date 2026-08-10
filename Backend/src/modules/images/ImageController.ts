/**
 * ImageController.ts
 *
 * Controller de imagens — armazenamento via Amazon S3.
 *
 * O que este arquivo faz:
 *  - Recebe imagens enviadas pelo frontend (PNG gerado pelo canvas).
 *  - Processa cada imagem em uma fila com limite de concorrência.
 *  - Faz upload para o Amazon S3 via S3Service.
 *  - Persiste metadados no banco de dados (Prisma/PostgreSQL) ou em disco como fallback.
 *  - Expõe apenas um endpoint:
 *      POST /images/upload → upload de imagens processadas.
 *
 * Proteções:
 *  - ConcurrencyLimiter: máximo de uploads simultâneos ao S3 (configurável via env).
 *  - withTimeout: cancela operações lentas após 45s.
 *  - Deduplicação: evita reprocessar o mesmo arquivo em menos de 60s.
 *  - Limite de 10 arquivos por requisição.
 */
import { Request, Response } from 'express';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { S3Service } from './S3Service.js';
import { uploadsDir } from '../../config/paths.js';
import { ConcurrencyLimiter } from '../../shared/utils/concurrencyLimiter.js';
import { withTimeout } from '../../shared/utils/withTimeout.js';
import { readPositiveInt } from '../../shared/utils/parseEnv.js';

// ═══════════════════════════════════════════════════════════════════════════
//  CONSTANTES E CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  amazon:        { width: 1000, height: 1000 },
  mercadolivre:  { width: 1200, height: 1200 },
  shopee:        { width: 1024, height: 1024 },
  magazineluiza: { width: 1000, height: 1000 },
  shein:         { width: 1500, height: 2000 },
  tiktok:        { width: 800,  height: 800  },
};

const IMAGE_MAX_CONCURRENCY = readPositiveInt(process.env.IMAGE_MAX_CONCURRENCY, 2);
const IMAGE_MAX_QUEUE_SIZE = readPositiveInt(process.env.IMAGE_MAX_QUEUE_SIZE, 100);
const IMAGE_QUEUE_WAIT_TIMEOUT_MS = readPositiveInt(process.env.IMAGE_QUEUE_WAIT_TIMEOUT_MS, 15000);
const IMAGE_PROCESS_TIMEOUT_MS = readPositiveInt(process.env.IMAGE_PROCESS_TIMEOUT_MS, 45000);
const IMAGE_UPLOAD_DEDUP_TTL_MS = readPositiveInt(process.env.IMAGE_UPLOAD_DEDUP_TTL_MS, 60000);

const imageLimiter = new ConcurrencyLimiter(IMAGE_MAX_CONCURRENCY, IMAGE_MAX_QUEUE_SIZE);

type UploadResponseItem = {
  id: string;
  processedName: string;
  s3Key: string;
  s3Url: string;
};

const inFlightUploads = new Map<string, Promise<UploadResponseItem>>();
const recentUploads = new Map<string, { expiresAt: number; result: UploadResponseItem }>();

// ═══════════════════════════════════════════════════════════════════════════
//  FUNÇÕES UTILITÁRIAS
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeFileName(name: string) {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_');
}

async function hashFile(filePath: string) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function cleanupRecentUploads() {
  const now = Date.now();
  for (const [key, value] of recentUploads.entries()) {
    if (value.expiresAt <= now) recentUploads.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

export class ImageController {
  private s3 = new S3Service();

  // ─────────────────────────────────────────────────────────────────────────
  //  POST /images/upload
  // ─────────────────────────────────────────────────────────────────────────
  upload = async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new AppError('Nenhuma imagem enviada', 400);
      }

      const MAX_FILES_PER_REQUEST = 10;
      if (files.length > MAX_FILES_PER_REQUEST) {
        throw new AppError(`Máximo de ${MAX_FILES_PER_REQUEST} imagens por requisição`, 400);
      }

      const marketplace = String(req.body.marketplace || 'amazon').toLowerCase();
      if (!DEFAULT_DIMENSIONS[marketplace]) {
        throw new AppError('Marketplace invalido', 400);
      }

      const bodyWidth = Number(req.body.width);
      const bodyHeight = Number(req.body.height);
      const fallback = DEFAULT_DIMENSIONS[marketplace];
      const MAX_IMAGE_DIMENSION = 8000;
      const width = Number.isFinite(bodyWidth) && bodyWidth > 0 && bodyWidth <= MAX_IMAGE_DIMENSION ? bodyWidth : fallback.width;
      const height = Number.isFinite(bodyHeight) && bodyHeight > 0 && bodyHeight <= MAX_IMAGE_DIMENSION ? bodyHeight : fallback.height;

      const items: UploadResponseItem[] = [];

      for (const file of files) {
        const runUpload = () =>
          imageLimiter.run(
            () =>
              withTimeout(
                () => this.processUploadFile({ req, file, marketplace, width, height }),
                IMAGE_PROCESS_TIMEOUT_MS,
                'Tempo limite excedido durante o processamento da imagem'
              ),
            { queueTimeoutMs: IMAGE_QUEUE_WAIT_TIMEOUT_MS }
          );

        const dedupKey = await this.buildDedupKey({ req, file, marketplace, width, height });

        const item = dedupKey
          ? await this.runWithDedup(dedupKey, runUpload)
          : await runUpload();

        items.push(item);
      }

      return res.status(201).json({ items });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[images] upload failed', error);
      throw new AppError('Falha ao processar upload de imagem', 500);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════

  private async processUploadFile(params: {
    req: Request;
    file: Express.Multer.File;
    marketplace: string;
    width: number;
    height: number;
  }): Promise<UploadResponseItem> {
    const { req, file, marketplace, width, height } = params;

    const safeName = sanitizeFileName(file.originalname || 'imagem');
    const baseName = safeName.replace(/\.[^.]+$/, '') || 'imagem';
    const finalName = baseName.toLowerCase().startsWith('img.processada')
      ? `${baseName}.png`
      : `img.processada_${baseName}.png`;
    const mimeType = 'image/png';

    // Chave S3: organiza por usuário → "images/<userId>/<storedFileName>"
    const s3Key = `images/${req.userId}/${file.filename}`;
    const filePath = path.join(uploadsDir, file.filename);

    let s3Url: string;
    try {
      const uploaded = await this.s3.uploadFile({ filePath, key: s3Key, mimeType });
      s3Url = uploaded.url;
    } catch (error) {
      // Limpa o arquivo temporário mesmo quando o upload falha.
      unlink(filePath).catch(() => {});
      console.error(`[images] S3 upload failed file=${file.filename}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Falha ao enviar imagem para o S3', 502);
    }

    // Persiste metadados no RDS (PostgreSQL via Prisma).
    let record;
    try {
      record = await prisma.processedImage.create({
        data: {
          userId: req.userId,
          fileName: file.originalname,
          finalName,
          storedFileName: file.filename,
          mimeType,
          marketplace,
          width,
          height,
          s3Key,
          s3Url,
        },
      });
    } catch (dbError) {
      unlink(filePath).catch(() => {});
      console.error('[images] falha ao persistir metadados no banco', dbError);
      throw new AppError('Banco de dados indisponível', 503);
    }

    // Remove o arquivo temporário do disco após salvar no S3 e no banco com sucesso.
    unlink(filePath).catch(() => {});

    return { id: record.id, processedName: finalName, s3Key, s3Url };
  }

  private async buildDedupKey(params: {
    req: Request;
    file: Express.Multer.File;
    marketplace: string;
    width: number;
    height: number;
  }) {
    try {
      const { req, file, marketplace, width, height } = params;
      const filePath = path.join(uploadsDir, file.filename);
      const fileHash = await hashFile(filePath);
      return [req.userId, fileHash, file.originalname || '', marketplace, width, height].join('|');
    } catch {
      return null;
    }
  }

  private async runWithDedup(key: string, task: () => Promise<UploadResponseItem>) {
    cleanupRecentUploads();

    const recent = recentUploads.get(key);
    if (recent && recent.expiresAt > Date.now()) return recent.result;

    const inflight = inFlightUploads.get(key);
    if (inflight) return inflight;

    const promise = task()
      .then((result) => {
        recentUploads.set(key, { result, expiresAt: Date.now() + IMAGE_UPLOAD_DEDUP_TTL_MS });
        return result;
      })
      .finally(() => inFlightUploads.delete(key));

    inFlightUploads.set(key, promise);
    return promise;
  }
}
