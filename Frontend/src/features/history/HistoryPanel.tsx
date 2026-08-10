import { motion } from 'framer-motion';
import { Download, Link2, Trash2, Clock, Eye, Search, X, LayoutGrid } from 'lucide-react';
import { HistoryItem, Marketplace } from '../../shared/types';
import { useState, useMemo } from 'react';
import { HistoryModal } from '../history/HistoryModal';
import { toast } from 'sonner';
import { marketplaceRules } from '../../shared/utils/marketplaceRules';
import amazonLogo from '../../assets/amazon-icon.svg';
import meliLogo from '../../assets/meli.png';
import shopeeLogo from '../../assets/shopee.png';
import magaluLogo from '../../assets/magalu.png';
import sheinLogo from '../../assets/shein.png';
import tiktokLogo from '../../assets/tiktok.png';

const MARKETPLACE_LOGOS: Record<string, string> = {
  amazon: amazonLogo,
  mercadolivre: meliLogo,
  shopee: shopeeLogo,
  magazineluiza: magaluLogo,
  shein: sheinLogo,
  tiktok: tiktokLogo,
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@radix-ui/react-alert-dialog';

interface HistoryPanelProps {
  history: HistoryItem[];
  onDownload: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onUpdateItem?: (item: HistoryItem) => void;
}

const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  magazineluiza: 'Magazine Luiza',
  shein: 'Shein',
  tiktok: 'TikTok Shop',
};

export function HistoryPanel({ history, onDownload, onDelete, onClearAll }: HistoryPanelProps) {
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState<Marketplace | ''>('');

  const stats = useMemo(() => {
    const byMarketplace: Record<string, number> = {};
    history.forEach((item) => {
      byMarketplace[item.marketplace] = (byMarketplace[item.marketplace] || 0) + 1;
    });
    return { total: history.length, byMarketplace };
  }, [history]);

  // Filtragem local (instantânea, sem chamada ao backend)
  const filtered = useMemo(() => {
    return history.filter((item) => {
      if (filterMarketplace && item.marketplace !== filterMarketplace) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !item.fileName.toLowerCase().includes(s) &&
          !(item.finalName || '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [history, search, filterMarketplace]);

  const hasFilters = search || filterMarketplace;

  const handleCopyLink = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = item.s3Url || item.processedImage;
    if (!url) { toast.error('Link não disponível'); return; }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterMarketplace('');
  };

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#0c151b',
        backgroundImage: `linear-gradient(to right,rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.04) 1px,transparent 1px)`,
        backgroundSize: '45px 45px',
      }}
    >
      <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-[#7cff4e] opacity-[0.08] blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-[#7cff4e] opacity-[0.08] blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center text-center mt-10 sm:mt-20 px-4"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: 'rgba(124,255,78,0.08)',
                border: '1px solid rgba(124,255,78,0.18)',
                boxShadow: '0 0 40px rgba(124,255,78,0.06)',
              }}
            >
              <Clock className="w-9 h-9" style={{ color: '#7cff4e', opacity: 0.8 }} />
            </div>
            <h3 className="text-white text-xl sm:text-2xl font-semibold mb-3 tracking-tight">
              Nenhuma imagem processada
            </h3>
            <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
              Vá até <span className="text-zinc-300 font-medium">Processar</span>, selecione um marketplace e envie suas imagens. Elas aparecerão aqui.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-600"
            >
              {['Amazon', 'Mercado Livre', 'Shopee', 'Magazine Luiza', 'Shein', 'TikTok'].map(name => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="inline-flex px-3 py-1 rounded-full border border-[#7cff4e]/20 bg-[#7cff4e]/10 text-[#7cff4e] text-xs font-bold uppercase tracking-widest">Histórico</span>
                <h2 className="text-white text-2xl sm:text-3xl font-bold mt-3 tracking-tight">Histórico de Processamento</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  <strong className="text-[#7cff4e]">{stats.total}</strong> {stats.total === 1 ? 'imagem processada' : 'imagens processadas'}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 self-start"
                    style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
                  >
                    <Trash2 className="w-4 h-4" /> Limpar Tudo
                  </motion.button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  style={{
                    backgroundColor: '#131d25',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    color: 'white',
                    maxWidth: '420px',
                    width: '90vw',
                  }}
                >
                  <div>
                    <AlertDialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Limpar histórico completo?
                    </AlertDialogTitle>
                    <AlertDialogDescription style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>
                      Todas as <strong style={{ color: 'white' }}>{stats.total} imagens</strong> processadas serão removidas permanentemente. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </div>
                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <AlertDialogCancel
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '9999px',
                        padding: '0.5rem 1rem',
                        color: '#94a3b8',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onClearAll}
                      style={{
                        backgroundColor: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        borderRadius: '9999px',
                        padding: '0.5rem 1rem',
                        color: '#f87171',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Sim, limpar tudo
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.byMarketplace).map(([mp, count]) => {
                const rules = marketplaceRules[mp];
                return (
                  <button
                    key={mp}
                    onClick={() => setFilterMarketplace(filterMarketplace === mp ? '' : mp as Marketplace)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: filterMarketplace === mp ? (rules?.color.primary + '22' || 'rgba(124,255,78,0.12)') : 'rgba(255,255,255,0.05)',
                      color: filterMarketplace === mp ? (rules?.color.primary || '#7cff4e') : '#94a3b8',
                      border: `1px solid ${filterMarketplace === mp ? (rules?.color.primary + '44' || 'rgba(124,255,78,0.3)') : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {rules && <img src={rules.logo} alt={rules.name} className="w-4 h-4 rounded-sm" />}
                    {MARKETPLACE_LABELS[mp] || mp}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome do arquivo..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setFilterMarketplace('')}
                  title="Todos os marketplaces"
                  className="w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: filterMarketplace === '' ? 'rgba(124,255,78,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${filterMarketplace === '' ? '#7cff4e' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: filterMarketplace === '' ? '0 0 10px rgba(124,255,78,0.25)' : 'none',
                  }}
                >
                  <LayoutGrid className="w-4 h-4" style={{ color: filterMarketplace === '' ? '#7cff4e' : '#6b7280' }} />
                </motion.button>

                {Object.entries(MARKETPLACE_LOGOS).map(([v, logo]) => {
                  const isActive = filterMarketplace === v;
                  const rules = marketplaceRules[v];
                  return (
                    <motion.button
                      key={v}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setFilterMarketplace(isActive ? '' : v as Marketplace)}
                      title={rules?.name || v}
                      className="w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all overflow-hidden"
                      style={{
                        backgroundColor: isActive ? (rules?.color.primary + '22' || 'rgba(124,255,78,0.12)') : 'rgba(255,255,255,0.05)',
                        border: `1.5px solid ${isActive ? (rules?.color.primary || '#7cff4e') : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: isActive ? `0 0 10px ${rules?.color.shadow || 'rgba(124,255,78,0.25)'}` : 'none',
                        padding: '5px',
                      }}
                    >
                      <img src={logo} alt={v} className="w-full h-full object-contain rounded-full" style={{ background: '#fff', borderRadius: '9999px' }} />
                    </motion.button>
                  );
                })}
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <X className="w-4 h-4" /> Limpar
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>Nenhuma imagem encontrada com os filtros aplicados.</p>
              </div>
            ) : (
              <>
                {hasFilters && (
                  <p className="text-zinc-500 text-sm">
                    Exibindo <strong className="text-[#7cff4e]">{filtered.length}</strong> de {stats.total} imagens
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filtered.map((item, index) => {
                    const rules = marketplaceRules[item.marketplace];
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        className="rounded-2xl overflow-hidden group bg-[#131d25] border border-white/5 hover:border-[#7cff4e]/30 transition-all duration-300"
                      >
                        <div className="relative aspect-[4/3] bg-[#0f172a] overflow-hidden">
                          <img
                            src={item.processedImage}
                            alt={item.fileName}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />

                          {rules && (
                            <div className="absolute top-2 left-2 z-10">
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1"
                                style={{ backgroundColor: rules.color.primary, color: '#fff' }}
                              >
                                {rules.name}
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-200 flex items-center justify-center gap-3 sm:opacity-0 sm:group-hover:opacity-100 opacity-0 pointer-events-none sm:pointer-events-auto">
                            <motion.button onClick={() => onDownload(item)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full flex items-center justify-center bg-[#7cff4e] text-white" title="Baixar">
                              <Download className="w-5 h-5" />
                            </motion.button>
                            <motion.button onClick={(e) => handleCopyLink(item, e)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-500 text-white" title="Copiar link">
                              <Link2 className="w-5 h-5" />
                            </motion.button>
                            <motion.button onClick={() => onDelete(item.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white" title="Remover">
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                            <motion.button onClick={() => setSelectedItem(item)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-black" title="Visualizar">
                              <Eye className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>

                        {/* Barra de ações mobile — visível apenas em telas < sm */}
                        <div className="flex sm:hidden items-center justify-between gap-2 px-3 py-2 border-t border-white/5">
                          <motion.button
                            onClick={() => setSelectedItem(item)}
                            whileTap={{ scale: 0.9 }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-white/5 text-white text-xs font-medium"
                            aria-label="Visualizar"
                          >
                            <Eye className="w-4 h-4" /> Ver
                          </motion.button>
                          <motion.button
                            onClick={() => onDownload(item)}
                            whileTap={{ scale: 0.9 }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-[#7cff4e]/10 text-[#7cff4e] text-xs font-medium"
                            aria-label="Baixar"
                          >
                            <Download className="w-4 h-4" /> Baixar
                          </motion.button>
                          <motion.button
                            onClick={(e) => handleCopyLink(item, e)}
                            whileTap={{ scale: 0.9 }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-medium"
                            aria-label="Copiar link"
                          >
                            <Link2 className="w-4 h-4" /> Link
                          </motion.button>
                          <motion.button
                            onClick={() => onDelete(item.id)}
                            whileTap={{ scale: 0.9 }}
                            className="py-3 px-4 rounded-lg bg-red-500/10 text-red-400"
                            aria-label="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>

                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{item.fileName}</p>
                              <p className="text-zinc-500 text-xs mt-1">
                                {new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 bg-[#7cff4e]/10 text-[#7cff4e] border border-[#7cff4e]/20">
                              {item.dimensions}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}

            {selectedItem && (
              <HistoryModal item={selectedItem} onClose={() => setSelectedItem(null)} onDownload={onDownload} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
