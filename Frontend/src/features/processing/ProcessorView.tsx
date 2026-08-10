import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from "framer-motion";
import { MultipleUploadArea } from '../uploads/MultipleUploadArea';
import { MarketplaceSelector } from '../marketplace/MarketplaceSelector';
import { ProcessingQueue } from './ProcessingQueue';
import { Marketplace, ImageItem, HistoryItem } from '../../shared/types';
import { marketplaceRules } from '../../shared/utils/marketplaceRules';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { buildApiUrl, fetchWithAuth } from '../../shared/services/api';
import { AUTH_USER_KEY, DOWNLOAD_FOLDER_KEY } from '../../shared/constants';

const CANVAS_TIMEOUT_MS = 30_000;
const ZIP_REVOKE_DELAY_MS = 60_000;
const ITEM_PROCESSING_DELAY_MS = 800;
const INTER_ITEM_DELAY_MS = 300;

interface ProcessorViewProps {
  onImageProcessed: (item: HistoryItem) => void;
  onUploadComplete?: (localId: string, serverItem: { id: string; processedName: string; s3Key: string; s3Url: string }) => void;
}

const sanitizeFileName = (name: string) =>
  name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_');

const sanitizeZipFolderName = (name: string) => {
  const trimmed = name.trim();
  const sanitized = sanitizeFileName(trimmed);
  if (!sanitized || sanitized === '.' || sanitized === '..') return 'imagens_processadas';
  return sanitized;
};

const buildProcessedName = (fileName: string) => {
  const safeName = sanitizeFileName(fileName || 'imagem.png');
  const base = getFileBaseName(safeName) || 'imagem';
  return `img.processada_${base}.png`;
};

const getFileExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex) : '';
};

const getFileBaseName = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(0, dotIndex) : name;
};

const buildUniqueFileName = (name: string, usedNames: Set<string>) => {
  const safeName = sanitizeFileName(name) || 'imagem.png';
  const ext = getFileExtension(safeName);
  const base = getFileBaseName(safeName);

  let candidate = safeName;
  let suffix = 1;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
};

const revokeObjectUrl = (value?: string) => {
  if (value?.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
};

const revokeItemObjectUrls = (item: ImageItem) => {
  revokeObjectUrl(item.preview);
  revokeObjectUrl(item.processedUrl);
};

const normalizeCustomName = (originalName: string, customBaseName?: string) => {
  const trimmed = customBaseName?.trim();
  const base = trimmed ? getFileBaseName(trimmed) : getFileBaseName(originalName);
  return `${base}.png`;
};

const buildProcessedNameFromInput = (originalName: string, customBaseName?: string) => {
  const fileName = normalizeCustomName(originalName, customBaseName);
  return buildProcessedName(fileName);
};

const buildProcessedNameForItem = (item: ImageItem, customBaseName?: string) => {
  return buildProcessedNameFromInput(
    item.file.name,
    customBaseName ?? item.customBaseName
  );
};

export function ProcessorView({ onImageProcessed, onUploadComplete }: ProcessorViewProps) {

  const [selectedMarketplace, setSelectedMarketplace] =
    useState<Marketplace>('mercadolivre');

  const [imageQueue, setImageQueue] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mirrors the queue for use inside the async processing loop.
  // Without the ref, closures would capture the stale initial state.
  const queueRef = useRef<ImageItem[]>([]);

  // Prevents two processing loops from running simultaneously if the user
  // clicks "Start" repeatedly before the first loop exits.
  const processingLockRef = useRef(false);

  const selectedRules = marketplaceRules[selectedMarketplace];

  // null = use the marketplace default dimensions.
  const [customDimensions, setCustomDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  const [downloadFolderName, setDownloadFolderName] = useState(() => {
    return localStorage.getItem(DOWNLOAD_FOLDER_KEY) || 'imagens_processadas';
  });

  const processImage = useCallback(
    async (
      file: File,
      marketplace: Marketplace,
      targetSize: { width: number; height: number }
    ): Promise<{ blob: Blob; url: string }> => {

      const processing = new Promise<{ blob: Blob; url: string }>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          const img = new Image();

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
              }

              const rules = marketplaceRules[marketplace];
              const width = targetSize.width;
              const height = targetSize.height;

              canvas.width = width;
              canvas.height = height;

              // High-quality interpolation when downscaling.
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              ctx.fillStyle = rules.backgroundColor;
              ctx.fillRect(0, 0, width, height);

              // Math.min ensures the image fits within the canvas without distortion.
              const scale = Math.min(width / img.width, height / img.height);
              const finalW = Math.round(img.width * scale);
              const finalH = Math.round(img.height * scale);

              // Multi-step downscaling preserves detail when the source is much larger
              // than the target — bilinear interpolation loses sharpness in a single
              // pass when the scale factor exceeds 2x.
              let source: CanvasImageSource = img;
              let srcW = img.width;
              let srcH = img.height;
              while (srcW > finalW * 2 || srcH > finalH * 2) {
                const stepW = Math.max(Math.ceil(srcW / 2), finalW);
                const stepH = Math.max(Math.ceil(srcH / 2), finalH);
                const step = document.createElement('canvas');
                step.width = stepW;
                step.height = stepH;
                const stepCtx = step.getContext('2d')!;
                stepCtx.imageSmoothingEnabled = true;
                stepCtx.imageSmoothingQuality = 'high';
                stepCtx.drawImage(source, 0, 0, stepW, stepH);
                source = step;
                srcW = stepW;
                srcH = stepH;
              }

              const x = Math.round((width - finalW) / 2);
              const y = Math.round((height - finalH) / 2);
              ctx.drawImage(source, x, y, finalW, finalH);

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to create blob'));
                    return;
                  }
                  // blob: URL for local preview — must be revoked when the item leaves the queue.
                  const url = URL.createObjectURL(blob);
                  resolve({ blob, url });
                },
                'image/png'
              );
            } catch (error) {
              reject(error);
            }
          };

          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = e.target?.result as string;
        };

        reader.onerror = () =>
          reject(new Error('Failed to read file'));

        reader.readAsDataURL(file);
      });

      // Rejects after CANVAS_TIMEOUT_MS to prevent the queue from hanging on a
      // corrupted image, out-of-memory condition, or browser canvas bug.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Tempo limite ao processar imagem')),
          CANVAS_TIMEOUT_MS
        )
      );

      return Promise.race([processing, timeout]);
    },
    []
  );

  const handleFilesSelect = useCallback(
    (files: File[]) => {
      const rules = marketplaceRules[selectedMarketplace];
      const baseSize = customDimensions
        ? { ...customDimensions }
        : { ...rules.size };

      const newItems: ImageItem[] = files.map((file) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'queued',
        progress: 0,
        marketplace: selectedMarketplace,
        targetSize: { ...baseSize },
        customBaseName: getFileBaseName(file.name),
        processedName: buildProcessedNameFromInput(
          file.name,
          getFileBaseName(file.name)
        ),
      }));

      setImageQueue((prev) => [...prev, ...newItems]);
    },
    [selectedMarketplace, customDimensions]
  );

  // Keeps queueRef in sync so the async processing loop always reads current state
  // rather than the stale closure-captured version from when the loop started.
  useEffect(() => {
    queueRef.current = imageQueue;
  }, [imageQueue]);

  // Revoke all blob: URLs when the component unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      queueRef.current.forEach(revokeItemObjectUrls);
    };
  }, []);

  const processQueue = useCallback(
    async () => {
      if (processingLockRef.current) return;
      processingLockRef.current = true;
      setIsProcessing(true);

      try {
        while (true) {
          const nextItem = queueRef.current.find(
            (item) => item.status === 'queued'
          );
          if (!nextItem) break;

          // Declared here so the upload block below can reference the canvas result.
          let processed: { blob: Blob; url: string } | null = null;
          let finalName = '';

          try {
            setImageQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id
                  ? { ...i, status: 'processing', progress: 30 }
                  : i
              )
            );

            // Lets the "processing" badge render before the main thread is blocked by canvas work.
            await new Promise((r) => setTimeout(r, ITEM_PROCESSING_DELAY_MS));

            setImageQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id ? { ...i, progress: 60 } : i
              )
            );

            processed = await processImage(
              nextItem.file,
              nextItem.marketplace,
              nextItem.targetSize
            );

            // Re-reads from queueRef in case the user renamed the item while it was processing.
            const latestItem =
              queueRef.current.find((item) => item.id === nextItem.id) || nextItem;
            finalName = buildProcessedNameForItem(latestItem);

            setImageQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id ? { ...i, progress: 90 } : i
              )
            );

            setImageQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id
                  ? {
                      ...i,
                      status: 'completed',
                      processedUrl: processed!.url,
                      processedLink: processed!.url,
                      processedName: finalName,
                      progress: 100,
                    }
                  : i
              )
            );

            // Register in history immediately with the local blob URL so the entry
            // always appears even if the server upload below fails.
            onImageProcessed({
              id: nextItem.id,
              fileName: nextItem.file.name,
              originalImage: nextItem.preview,
              processedImage: processed.url,
              marketplace: nextItem.marketplace,
              timestamp: Date.now(),
              dimensions: `${nextItem.targetSize.width}x${nextItem.targetSize.height}`,
              finalName,
            });

          } catch (error) {
            // Canvas errors only — server upload errors are caught in the block below.
            const message =
              error instanceof Error
                ? error.message
                : 'Falha ao processar. Tente novamente.';
            setImageQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id
                  ? { ...i, status: 'error', error: message }
                  : i
              )
            );
          }

          // Non-blocking upload — server failures don't revert 'completed' status or
          // remove the item from the local history entry created above.
          if (processed) {
            try {
              const formData = new FormData();
              formData.append('images', processed.blob, finalName);
              formData.append('marketplace', nextItem.marketplace);
              formData.append('width', String(nextItem.targetSize.width));
              formData.append('height', String(nextItem.targetSize.height));

              const uploadResp = await fetchWithAuth(buildApiUrl('/images/upload'), {
                method: 'POST',
                body: formData,
              });

              if (uploadResp.ok) {
                const uploadData = await uploadResp.json();
                const serverItem = uploadData.items?.[0];
                if (serverItem?.s3Url) {
                  setImageQueue((prev) =>
                    prev.map((i) =>
                      i.id === nextItem.id
                        ? { ...i, processedLink: serverItem.s3Url }
                        : i
                    )
                  );
                }
                if (serverItem?.id && serverItem?.s3Key) {
                  onUploadComplete?.(nextItem.id, {
                    id: serverItem.id,
                    processedName: serverItem.processedName,
                    s3Key: serverItem.s3Key,
                    s3Url: serverItem.s3Url,
                  });
                }
                toast.success('Imagem processada e salva na nuvem');
              } else if (uploadResp.status === 401) {
                localStorage.removeItem(AUTH_USER_KEY);
                toast.error('Sessão expirada. Faça login novamente.');
              } else {
                const errBody = await uploadResp.json().catch(() => ({}));
                console.warn('[upload] S3 falhou:', errBody.error);
                toast.warning('Imagem processada. Não foi possível salvar na nuvem — verifique as credenciais AWS.');
              }
            } catch (uploadErr) {
              console.warn('[upload] erro de rede:', uploadErr);
              toast.warning('Imagem processada localmente. Servidor indisponível.');
            }
          }

          // Brief pause between items so the UI can re-render before the next canvas operation.
          await new Promise((r) => setTimeout(r, INTER_ITEM_DELAY_MS));
        }
      } finally {
        processingLockRef.current = false;
        setIsProcessing(false);
      }
    },
    [processImage, onImageProcessed, onUploadComplete]
  );

  const handleRemoveItem = useCallback((id: string) => {
    setImageQueue((prev) => {
      const item = prev.find((candidate) => candidate.id === id);
      if (item) {
        revokeItemObjectUrls(item);
      }
      return prev.filter((candidate) => candidate.id !== id);
    });
  }, []);

  const handleDownloadItem = useCallback(
    (id: string) => {
      const item = imageQueue.find((i) => i.id === id);
      if (!item?.processedUrl) return;

      const link = document.createElement('a');
      link.href = item.processedUrl;
      link.download =
        item.processedName || buildProcessedNameForItem(item);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [imageQueue]
  );

  const handleCopyItemLink = useCallback(
    async (id: string) => {
      const item = imageQueue.find((i) => i.id === id);
      const linkValue = item?.processedLink || item?.processedUrl;

      if (!linkValue) {
        toast.error('Link da imagem ainda não está disponível');
        return;
      }

      try {
        await navigator.clipboard.writeText(linkValue);
        toast.success('Link copiado');
      } catch {
        toast.error('Não foi possível copiar o link');
      }
    },
    [imageQueue]
  );

  const handleDownloadAll = useCallback(() => {
    // Prevents generating two ZIPs simultaneously on double-click.
    if (isGeneratingZip) return;

    const items = imageQueue.filter(
      (i) => i.status === 'completed' && i.processedUrl
    );

    if (items.length === 0) {
      toast.info('Nenhuma imagem concluída para baixar');
      return;
    }

    const folderName = sanitizeZipFolderName(downloadFolderName);
    const zipFileName = `${folderName}.zip`;
    const toastId = toast.loading(`Gerando ZIP (${items.length})...`);

    setIsGeneratingZip(true);

    (async () => {
      // Declared before the try block so it can be revoked in the catch on error.
      let zipUrl: string | null = null;
      try {
        const zip = new JSZip();
        const zipFolder = zip.folder(folderName) ?? zip;
        const usedNames = new Set<string>();

        for (const item of items) {
          const fileName = buildUniqueFileName(
            item.processedName || buildProcessedNameForItem(item),
            usedNames
          );

          const resp = await fetch(item.processedUrl!);
          if (!resp.ok) {
            throw new Error(`Falha ao baixar ${fileName}`);
          }
          const blob = await resp.blob();
          zipFolder.file(fileName, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        zipUrl = URL.createObjectURL(zipBlob);

        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 60 seconds gives the browser enough time to start the download before we revoke.
        setTimeout(() => {
          if (zipUrl) URL.revokeObjectURL(zipUrl);
        }, ZIP_REVOKE_DELAY_MS);

        toast.dismiss(toastId);
        toast.success('Download iniciado');
      } catch (error: any) {
        if (zipUrl) URL.revokeObjectURL(zipUrl);
        console.error(error);
        toast.error(`Erro ao gerar ZIP: ${error?.message || 'Tente novamente'}`, {
          id: toastId,
        });
      } finally {
        setIsGeneratingZip(false);
      }
    })();
  }, [isGeneratingZip, imageQueue, downloadFolderName]);

  const handleRenameItem = useCallback((id: string, value: string) => {
    setImageQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, customBaseName: value, processedName: buildProcessedNameForItem(item, value) }
          : item
      )
    );
  }, []);

  const handleChangeItemMarketplace = useCallback((id: string, marketplace: Marketplace) => {
    const rules = marketplaceRules[marketplace];
    setImageQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, marketplace, targetSize: rules ? { ...rules.size } : item.targetSize }
          : item
      )
    );
  }, []);

  const handleStartProcessing = useCallback(() => {
    processQueue();
  }, [processQueue]);

  const handleClearCompleted = useCallback(() => {
    setImageQueue((prev) => {
      prev
        .filter((item) => item.status === 'completed')
        .forEach(revokeItemObjectUrls);
      return prev.filter((item) => item.status !== 'completed');
    });
  }, []);

  const completedCount = imageQueue.filter((i) => i.status === 'completed').length;
  const queuedCount = imageQueue.filter((i) => i.status === 'queued').length;
  const canStartProcessing = queuedCount > 0 && !isProcessing;

  return (
    <div
      className="min-h-screen w-full text-white selection:bg-[#7cff4e]/30 flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#0c151b',
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '45px 45px',
      }}
    >
      {/* Diffuse green glow — visual signature of the SPI interface. */}
      <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-[#7cff4e] opacity-[0.08] blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-[#7cff4e] opacity-[0.08] blur-[150px] pointer-events-none" />
      {/* Radial vignette darkens the edges to draw focus toward the center. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 10%, #0c151b 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 lg:gap-6"
        >
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex px-3 py-1 rounded-full border border-[#7cff4e]/20 bg-[#7cff4e]/10 text-[#7cff4e] text-xs font-bold uppercase tracking-widest">
              Processamento
            </span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white tracking-tight">
              Padronize imagens sem retrabalho
            </h2>
            <p className="text-muted text-sm sm:text-base leading-relaxed">
              Selecione o marketplace, defina as dimensões e envie múltiplas imagens
              para processamento em lote com padrão profissional.
            </p>
          </div>

          <div className="panel-surface rounded-2xl px-5 py-4 w-full lg:w-auto">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
              Marketplace ativo
            </p>
            <div className="mt-2 flex items-center gap-3">
              <img
                src={selectedRules.logo}
                alt={selectedRules.name}
                className="w-10 h-10 rounded-full bg-white p-1"
              />
              <div>
                <p className="text-white font-semibold">{selectedRules.name}</p>
                <p className="text-muted text-xs">{selectedRules.dimensions}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted">
              <span>
                <strong className="text-[#7cff4e]">{imageQueue.length}</strong> na fila
              </span>
              <span>
                <strong className="text-[#7cff4e]">{completedCount}</strong> concluídas
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-[1.2fr,0.8fr] gap-6 items-stretch"
        >
          <div className="rounded-2xl p-5 sm:p-7 app-panel">
            <MarketplaceSelector
              selected={selectedMarketplace}
              onSelect={setSelectedMarketplace}
              onDimensionsChange={setCustomDimensions}
              disabled={isProcessing}
            />
          </div>

          <div className="flex flex-col">
            <div className="rounded-2xl p-5 sm:p-7 app-panel flex-1 flex flex-col justify-center">
              <MultipleUploadArea
                onFilesSelect={handleFilesSelect}
                maxFiles={10}
                disabled={isProcessing && imageQueue.length >= 10}
              />
            </div>
          </div>
        </motion.div>

        {imageQueue.length > 0 && (
          <>
            <motion.div className="rounded-2xl p-5 sm:p-7 app-panel">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                  <p className="text-sm text-gray-100 font-medium">
                    Renomeie os arquivos e inicie o processamento
                  </p>
                  <p className="text-xs text-muted">
                    Edite os nomes abaixo antes de redimensionar.
                  </p>
                </div>
                <button
                  onClick={handleStartProcessing}
                  disabled={!canStartProcessing}
                  className={`px-5 py-3 rounded-full flex items-center justify-center gap-2 font-semibold transition-all shadow-lg ${
                    !canStartProcessing
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed shadow-none'
                      : 'bg-[#7cff4e] text-white hover:bg-[#7cff4e]/90 shadow-[#7cff4e]/20'
                  }`}
                >
                  {isProcessing ? 'Processando...' : `Iniciar processamento (${queuedCount})`}
                </button>
              </div>

              <ProcessingQueue
                items={imageQueue}
                onRemove={handleRemoveItem}
                onDownload={handleDownloadItem}
                onCopyLink={handleCopyItemLink}
                onRename={handleRenameItem}
                onChangeMarketplace={handleChangeItemMarketplace}
              />

              {completedCount > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      Nome do arquivo ZIP
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={downloadFolderName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDownloadFolderName(value);
                          localStorage.setItem(DOWNLOAD_FOLDER_KEY, value);
                        }}
                        placeholder="imagens_processadas"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#7cff4e] outline-none transition-all"
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        → {sanitizeZipFolderName(downloadFolderName) || 'imagens_processadas'}.zip
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                    <button
                      onClick={handleClearCompleted}
                      className="px-5 py-3 rounded-full border border-white/10 text-gray-200 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Limpar concluídos
                    </button>

                    <button
                      onClick={handleDownloadAll}
                      disabled={isGeneratingZip}
                      className={`px-5 py-3 rounded-full flex items-center justify-center gap-2 font-semibold transition-all shadow-lg ${
                        isGeneratingZip
                          ? 'bg-[#7cff4e]/50 text-white cursor-not-allowed shadow-none'
                          : 'bg-[#7cff4e] text-white hover:bg-[#7cff4e]/90 shadow-[#7cff4e]/20'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      {isGeneratingZip ? 'Gerando ZIP...' : `Baixar todas (${completedCount})`}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
