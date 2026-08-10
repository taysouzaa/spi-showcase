export type Marketplace = 'amazon' | 'mercadolivre' | 'shopee' | 'magazineluiza' | 'shein' | 'tiktok';

export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface ImageItem {
  id: string;
  file: File;
  preview: string;                                  // blob: URL — must be revoked when item leaves the queue.
  status: ProcessingStatus;
  marketplace: Marketplace;
  targetSize: { width: number; height: number };
  customBaseName?: string;
  processedName?: string;                           // Always ends in .png after normalization.
  processedUrl?: string;
  processedLink?: string;
  error?: string;
  progress: number;                                 // 0–100 for the progress bar.
  bgRemoved?: boolean;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  originalImage: string;                            // May be empty for items processed before this field existed.
  processedImage: string;
  marketplace: Marketplace;
  timestamp: number;
  dimensions: string;
  finalName?: string;
  s3Key?: string;                                   // Stored to build direct download URLs without extra API calls.
  s3Url?: string;
  qualityEnhanced?: boolean;
}

export interface MarketplaceRules {
  id: Marketplace;
  name: string;
  dimensions: string;
  aspectRatio: string;
  size: { width: number; height: number };
  backgroundColor: string;                          // HEX — applied as canvas fill before drawing the product image.
  maxFileSize: string;                              // Informational string (e.g. "10MB"), not enforced client-side.
  requirements: string[];
  color: {
    primary: string;                                // Brand primary color — used in marketplace selection cards.
    shadow: string;                                 // RGBA glow color — used on hover effects.
  };
  logo: string;
}
