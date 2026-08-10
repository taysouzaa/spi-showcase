import { motion } from 'framer-motion';
import { ImageItem, Marketplace } from '../../shared/types';
import { marketplaceRules } from '../../shared/utils/marketplaceRules';
import { Check, X, Loader2, Clock, Download, Link2 } from 'lucide-react';
import amazonLogo from '../../assets/amazon-icon.svg';
import meliLogo from '../../assets/meli.png';
import shopeeLogo from '../../assets/shopee.png';
import magaluLogo from '../../assets/magalu.png';
import sheinLogo from '../../assets/shein.png';
import tiktokLogo from '../../assets/tiktok.png';

const MARKETPLACE_OPTIONS: { value: Marketplace; label: string; logo: string }[] = [
  { value: 'amazon',        label: 'Amazon',         logo: amazonLogo  },
  { value: 'mercadolivre',  label: 'Mercado Livre',  logo: meliLogo    },
  { value: 'shopee',        label: 'Shopee',          logo: shopeeLogo  },
  { value: 'magazineluiza', label: 'Magazine Luiza',  logo: magaluLogo  },
  { value: 'shein',         label: 'Shein',           logo: sheinLogo   },
  { value: 'tiktok',        label: 'TikTok Shop',     logo: tiktokLogo  },
];

interface ProcessingQueueProps {
  items: ImageItem[];
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
  onCopyLink: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onChangeMarketplace: (id: string, marketplace: Marketplace) => void;
}

const getFileBaseName = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(0, dotIndex) : name;
};

const STATUS_CONFIG: Record<ImageItem['status'], { icon: JSX.Element; label: string; color: string }> = {
  queued:     { icon: <Clock className="w-5 h-5" style={{ color: '#9CA3AF' }} />,                    label: 'Na fila',        color: '#9CA3AF' },
  processing: { icon: <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7CFF4E' }} />,     label: 'Processando...', color: '#c8ff2a' },
  completed:  { icon: <Check className="w-5 h-5" style={{ color: '#7CFF4E' }} />,                    label: 'Concluído',      color: '#7CFF4E' },
  error:      { icon: <X className="w-5 h-5" style={{ color: '#EF4444' }} />,                        label: 'Erro',           color: '#EF4444' },
};

export function ProcessingQueue({
  items,
  onRemove,
  onDownload,
  onCopyLink,
  onRename,
  onChangeMarketplace,
}: ProcessingQueueProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="text-gray-100 font-semibold text-base">Fila de Processamento</h3>
        <span className="text-xs text-gray-400">
          {items.filter((i) => i.status === 'completed').length} de {items.length} concluídos
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const rules = marketplaceRules[item.marketplace];
          const isPending = item.status === 'queued';
          const statusCfg = STATUS_CONFIG[item.status];

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: 'rgba(12, 18, 24, 0.75)',
                borderWidth: '1px',
                borderColor:
                  item.status === 'error' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div
                  className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative"
                  style={{ backgroundColor: 'rgba(15,23,31,0.9)' }}
                >
                  <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover" />
                  {item.status === 'processing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{item.file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </p>

                  {isPending && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={item.customBaseName ?? getFileBaseName(item.file.name)}
                            onChange={(e) => onRename(item.id, e.target.value)}
                            placeholder="Nome do arquivo"
                            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-100 bg-black/30 border border-white/10 outline-none focus:border-[#7CFF4E]"
                          />
                          <span className="text-[10px] text-gray-400">.png</span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          {MARKETPLACE_OPTIONS.map((opt) => {
                            const isActive = item.marketplace === opt.value;
                            const optRules = marketplaceRules[opt.value];
                            return (
                              <motion.button
                                key={opt.value}
                                type="button"
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onChangeMarketplace(item.id, opt.value)}
                                title={opt.label}
                                className="w-10 h-10 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                  padding: '3px',
                                  backgroundColor: isActive
                                    ? (optRules?.color.primary + '33' || 'rgba(124,255,78,0.2)')
                                    : 'rgba(255,255,255,0.05)',
                                  border: `1.5px solid ${isActive
                                    ? (optRules?.color.primary || '#7cff4e')
                                    : 'rgba(255,255,255,0.1)'}`,
                                  boxShadow: isActive
                                    ? `0 0 8px ${optRules?.color.shadow || 'rgba(124,255,78,0.3)'}`
                                    : 'none',
                                }}
                              >
                                <img
                                  src={opt.logo}
                                  alt={opt.label}
                                  className="w-full h-full object-contain rounded-full"
                                  style={{ background: '#fff', borderRadius: '9999px' }}
                                />
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                  {item.status === 'completed' && (
                    <p className="text-[11px] text-gray-400 mt-2 truncate">
                      {item.processedName || item.file.name}
                      {rules && (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{ backgroundColor: rules.color.primary + '22', color: rules.color.primary }}
                        >
                          {rules.name}
                        </span>
                      )}
                    </p>
                  )}

                  {item.status === 'processing' && (
                    <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#7CFF4E' }}
                      />
                    </div>
                  )}

                  {item.status === 'error' && item.error && (
                    <p className="text-xs mt-1 font-medium" style={{ color: '#FCA5A5' }}>
                      {item.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: `${statusCfg.color}18` }}
                  >
                    {statusCfg.icon}
                    <span className="text-xs font-semibold" style={{ color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {item.status === 'completed' && (
                    <>
                      <motion.button
                        onClick={() => onCopyLink(item.id)}
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center bg-blue-500"
                        title="Copiar link"
                      >
                        <Link2 className="w-4 h-4 text-white" />
                      </motion.button>
                      <motion.button
                        onClick={() => onDownload(item.id)}
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#7CFF4E' }}
                        title="Baixar"
                      >
                        <Download className="w-4 h-4 text-black" />
                      </motion.button>
                    </>
                  )}

                  <motion.button
                    onClick={() => onRemove(item.id)}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: item.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                    }}
                    title="Remover"
                  >
                    <X className="w-4 h-4" style={{ color: item.status === 'error' ? '#EF4444' : '#9CA3AF' }} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
