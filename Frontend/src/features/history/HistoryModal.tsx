/**
 * features/history/HistoryModal.tsx
 *
 * Modal de detalhe de um item do histórico.
 *
 * O que este arquivo faz:
 *  - Exibe um overlay com comparação visual: imagem original vs processada.
 *  - Mostra metadados do item: data de processamento, horário e qualidade.
 *  - Oferece botões de fechar e baixar a imagem processada.
 *  - Fecha ao clicar no overlay externo (`onClick` no backdrop).
 *  - Anima entrada/saída com Framer Motion (fade + scale).
 *
 * Sobre a imagem original no modal:
 *  - Nem todo item do histórico preserva a imagem original — o blob URL gerado
 *    no momento do upload não sobrevive à serialização no localStorage.
 *  - Quando `originalImage` está vazio ou igual à processada, exibe mensagem explicativa
 *    ao invés de um painel vazio ou duplicado.
 *
 * Props:
 *  - `item`       → item selecionado (null = modal fechado).
 *  - `onClose`    → callback para fechar o modal.
 *  - `onDownload` → callback para iniciar download da imagem processada.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Calendar } from 'lucide-react';
import { HistoryItem } from '../../shared/types';

interface HistoryModalProps {
  item: HistoryItem | null;
  onClose: () => void;
  onDownload: (item: HistoryItem) => void;
}

export function HistoryModal({ item, onClose, onDownload }: HistoryModalProps) {
  // Modal não renderiza nada quando nenhum item está selecionado.
  if (!item) return null;

  // Determina se a imagem original está disponível e é distinta da processada.
  // Blob URLs (geradas na sessão) não persistem entre recarregamentos.
  // URLs http/https são válidas; blob: URLs podem ter expirado.
  const hasOriginalImage =
    Boolean(item.originalImage) &&
    item.originalImage !== item.processedImage &&
    (item.originalImage.startsWith('http') || item.originalImage.startsWith('blob:'));

  return (
    <AnimatePresence>
      {/* ── Backdrop ────────────────────────────────────────────────────────────
          Clique fora do card fecha o modal. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8"
        style={{ backgroundColor: 'rgba(8, 12, 16, 0.88)' }}
      >
        {/* ── Card do modal ──────────────────────────────────────────────────────
            `stopPropagation` evita fechar ao clicar dentro do card. */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl rounded-2xl overflow-hidden card-blur"
          style={{
            maxHeight: '90vh',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
          <div
            className="px-6 sm:px-8 py-6 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(10, 16, 22, 0.9)' }}
          >
            <div>
              <h2 className="text-xl font-semibold text-white">
                Visualização da Imagem
              </h2>
              <p className="text-sm text-muted mt-1">{item.fileName}</p>
            </div>

            {/* Botão de fechar com animação de rotação no hover. */}
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            >
              <X className="w-5 h-5 text-gray-300" />
            </motion.button>
          </div>

          {/* ── Corpo com scroll ──────────────────────────────────────────────── */}
          <div
            className="p-6 sm:p-8 overflow-y-auto"
            style={{ maxHeight: 'calc(90vh - 180px)' }}
          >
            {/* Imagem processada em largura total */}
            <div className="mb-6">
              <div className="rounded-xl border border-white/10 bg-[#0b1218] p-4 sm:p-6 flex justify-center items-center min-h-[300px] sm:min-h-[460px]">
                <img
                  src={item.processedImage}
                  alt="Processada"
                    className="max-h-[400px] object-contain rounded-lg"
                  />
              </div>
            </div>

            {/* ── Metadados do item ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Data e hora de processamento. */}
              <div className="p-4 rounded-xl bg-[#0b1218]">
                <span className="text-xs font-semibold text-muted uppercase">
                  Processado em
                </span>
                <div className="flex items-center gap-2 mt-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-100">
                      {new Date(item.timestamp).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(item.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Indicador de qualidade — fundo esverdeado quando otimizada. */}
              <div
                className="p-4 rounded-xl"
                style={{
                  backgroundColor: item.qualityEnhanced
                    ? 'rgba(124, 255, 78, 0.16)'
                    : '#0b1218',
                }}
              >
                <span className="text-xs font-semibold text-muted uppercase">
                  Qualidade
                </span>
                <p className="mt-3 font-semibold text-gray-100">
                  {item.qualityEnhanced ? 'Otimizada' : 'Padrão'}
                </p>
                <p className="text-xs text-muted">
                  {item.qualityEnhanced
                    ? 'Alta qualidade aplicada'
                    : 'Sem otimização'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Rodapé com ações ──────────────────────────────────────────────── */}
          <div
            className="px-6 sm:px-8 py-6 flex justify-end gap-3 border-t border-white/10"
            style={{ backgroundColor: 'rgba(10, 16, 22, 0.9)' }}
          >
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-full font-medium border border-white/10 text-gray-200 bg-white/5"
            >
              Fechar
            </motion.button>

            <motion.button
              onClick={() => onDownload(item)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-full font-medium text-black flex items-center gap-2 btn-primary"
            >
              <Download className="w-4 h-4" />
              Baixar Imagem
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
