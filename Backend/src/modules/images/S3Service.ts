/**
 * S3Service.ts
 *
 * Serviço de armazenamento de imagens via Amazon S3.
 *
 * Substitui o GoogleDriveService — toda imagem processada agora vai direto para
 * um bucket S3 configurado no ambiente. Não depende de service account nem de
 * permissões manuais de pasta; apenas de credenciais IAM + nome do bucket.
 *
 * Credenciais aceitas (por ordem de prioridade):
 *  1. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (variáveis de ambiente)
 *  2. IAM Role / Instance Profile (automático em EC2, Elastic Beanstalk, Lambda)
 *
 * Variáveis obrigatórias:
 *  - AWS_S3_BUCKET  → nome do bucket (ex: "seu-bucket-de-imagens")
 *  - AWS_REGION     → região do bucket (ex: "us-east-1")
 *
 * Variável opcional:
 *  - S3_PRESIGN_EXPIRY_SECONDS → TTL das URLs pré-assinadas (padrão: 7 dias)
 *
 * Por que URLs pré-assinadas e não URLs públicas?
 *  - Permite manter o bucket privado, sem expor os arquivos ao público geral.
 *  - A URL expira e só funciona com a assinatura gerada pelo backend.
 *  - Para buckets com acesso público configurado, `getPublicUrl()` retorna
 *    a URL estática (sem expiração) — mais simples para produção.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import { AppError } from '../../shared/errors/AppError.js';
import { readPositiveInt } from '../../shared/utils/parseEnv.js';

// ─── Configuração ──────────────────────────────────────────────────────────────

const DEFAULT_PRESIGN_EXPIRY = 60 * 60 * 24 * 7; // 7 dias em segundos

// ─── Serviço ───────────────────────────────────────────────────────────────────

export class S3Service {
  private client: S3Client;
  private bucket: string;
  private presignExpiry: number;

  constructor() {
    const bucket = process.env.AWS_S3_BUCKET?.trim();
    if (!bucket) {
      throw new AppError('AWS_S3_BUCKET não configurado', 500);
    }

    const region = process.env.AWS_REGION?.trim() || 'us-east-1';

    this.bucket = bucket;
    this.presignExpiry = readPositiveInt(
      process.env.S3_PRESIGN_EXPIRY_SECONDS,
      DEFAULT_PRESIGN_EXPIRY
    );

    // Quando AWS_ACCESS_KEY_ID não está definido, o SDK usa automaticamente
    // a IAM Role do servidor (EC2, Elastic Beanstalk, Lambda) — sem segredo no código.
    const credentials =
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined;

    this.client = new S3Client({ region, credentials });
  }

  /**
   * Faz upload de um arquivo local para o S3.
   *
   * @param filePath  Caminho absoluto do arquivo em disco.
   * @param key       Chave de destino no S3 (ex: "images/userId/uuid.png").
   * @param mimeType  MIME type do arquivo (ex: "image/png").
   * @returns Objeto com `key` e `url` (pública estática ou pré-assinada).
   */
  async uploadFile(params: {
    filePath: string;
    key: string;
    mimeType: string;
  }): Promise<{ key: string; url: string }> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.key,
          Body: createReadStream(params.filePath),
          ContentType: params.mimeType,
        })
      );
    } catch (error: any) {
      console.error('[S3] upload failed', error);
      const code = error?.name || error?.Code;
      if (code === 'NoSuchBucket') {
        throw new AppError(`Bucket S3 "${this.bucket}" não encontrado`, 502);
      }
      if (code === 'AccessDenied') {
        throw new AppError('Sem permissão para gravar no bucket S3', 502);
      }
      throw new AppError('Falha ao enviar imagem para o S3', 502);
    }

    const url = this.getPublicUrl(params.key);
    return { key: params.key, url };
  }

  /**
   * Gera uma URL pré-assinada para acesso temporário a um objeto privado.
   * A URL expira após `presignExpiry` segundos (padrão: 7 dias).
   *
   * @param key Chave do objeto no S3.
   * @returns URL pré-assinada válida por `presignExpiry` segundos.
   */
  async getPresignedUrl(key: string, options?: { fileName?: string; expiresIn?: number }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options?.fileName
        ? { ResponseContentDisposition: `attachment; filename="${options.fileName}"` }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: options?.expiresIn ?? this.presignExpiry });
  }

  /**
   * Remove um objeto do bucket S3.
   * Falha silenciosa: se o objeto não existir, não lança erro.
   *
   * @param key Chave do objeto a remover.
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
      );
    } catch (error) {
      // Ignoramos erros de delete — se o arquivo não existe, tudo bem.
      console.warn('[S3] delete warning', error);
    }
  }

  /**
   * Retorna a URL pública estática do objeto.
   * Funciona apenas quando o bucket é público (ACL pública ou bucket policy aberta).
   * Para buckets privados, use `getPresignedUrl()`.
   *
   * @param key Chave do objeto no S3.
   * @returns URL no formato `https://<bucket>.s3.<region>.amazonaws.com/<key>`.
   */
  getPublicUrl(key: string): string {
    const region = process.env.AWS_REGION?.trim() || 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
}
