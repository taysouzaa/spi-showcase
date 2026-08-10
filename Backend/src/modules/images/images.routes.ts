/**
 * modules/images/images.routes.ts
 *
 * Rotas de upload de imagens — armazenamento via Amazon S3.
 *
 * Endpoints:
 *  POST /images/upload  → processa e salva imagens no S3 (requer auth).
 */
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ImageController } from './ImageController.js';
import { ensureAuth } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { AppError } from '../../shared/errors/AppError.js';
import { uploadsDir } from '../../config/paths.js';

const router = Router();
const controller = new ImageController();

const IMAGE_EXTENSIONS = new Set([
  'avif', 'bmp', 'gif', 'heic', 'heif', 'ico',
  'jfif', 'jpg', 'jpeg', 'pjp', 'pjpeg',
  'png', 'tif', 'tiff', 'webp',
]);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
    const isImageMime = file.mimetype?.startsWith('image/');
    const isImageExt = ext ? IMAGE_EXTENSIONS.has(ext) : false;
    // AMBOS devem ser válidos — evita bypass com extensão correta + MIME arbitrário.
    if (!isImageMime || !isImageExt) {
      cb(new AppError('Apenas arquivos de imagem sao aceitos', 400) as Error);
      return;
    }
    cb(null, true);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de uploads atingido. Tente novamente em 1 hora.' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/upload', ensureAuth, uploadLimiter, upload.array('images', 10), asyncHandler(controller.upload));

export default router;
