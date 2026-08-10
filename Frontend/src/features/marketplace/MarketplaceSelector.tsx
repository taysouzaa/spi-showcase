/**
 * MarketplaceSelector.tsx
 *
 * Componente para selecionar o marketplace de destino e definir as dimensões da imagem.
 *
 * O que este arquivo faz:
 *  - Exibe cards clicáveis para cada marketplace (Mercado Livre, Shopee, Amazon).
 *  - Cada card mostra o logo, nome e dimensão padrão do canal.
 *  - Um botão de info (ⓘ) revela os requisitos detalhados de cada marketplace.
 *  - Permite escolher entre dimensões "Padrão" (definidas pelas regras de cada canal)
 *    ou "Personalizado" (largura/altura livres entre 1 e 4096 px).
 *  - Quando o marketplace é trocado, as dimensões voltam automaticamente ao padrão.
 *  - Exibe um aviso destacado quando o modo personalizado está ativo.
 *
 * Props recebidas de ProcessorView:
 *  - selected: qual marketplace está ativo no momento.
 *  - onSelect: callback chamado quando o usuário troca de marketplace.
 *  - onDimensionsChange: callback chamado quando as dimensões mudam (null = usar o padrão).
 *  - disabled: bloqueia toda interação enquanto há processamento em andamento.
 */
import { Info, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Marketplace } from '../../shared/types';
import { marketplaceRules } from '../../shared/utils/marketplaceRules';

// ─── Tipos das props ──────────────────────────────────────────────────────────
interface MarketplaceSelectorProps {
  selected: Marketplace;
  onSelect: (marketplace: Marketplace) => void;
  onDimensionsChange: (
    dimensions: { width: number; height: number } | null
  ) => void;
  disabled?: boolean;
}

// Ordem de exibição dos cards de marketplace na grade.
// Altere aqui para mudar a sequência visual sem tocar nas regras.
const marketplaceOrder: Marketplace[] = ['mercadolivre', 'shopee', 'amazon', 'magazineluiza', 'shein', 'tiktok'];

export function MarketplaceSelector({
  selected,
  onSelect,
  onDimensionsChange,
  disabled,
}: MarketplaceSelectorProps) {
  // ─── Estado local ─────────────────────────────────────────────────────────
  // showInfo: qual marketplace está com o painel de requisitos aberto (null = nenhum).
  const [showInfo, setShowInfo] = useState<Marketplace | null>(null);

  // dimensionMode: 'preset' usa as dimensões padrão do marketplace,
  //                'custom' usa os valores dos inputs abaixo.
  const [dimensionMode, setDimensionMode] = useState<'preset' | 'custom'>(
    'preset'
  );

  // Regras do marketplace atualmente selecionado (dimensões, cores, logo, etc.)
  const selectedRules = marketplaceRules[selected];

  // Valores dos inputs de dimensão personalizada.
  // Inicializados com as dimensões padrão do marketplace selecionado.
  const [customWidth, setCustomWidth] = useState(selectedRules.size.width);
  const [customHeight, setCustomHeight] = useState(selectedRules.size.height);

  // ─── Efeito: resetar dimensões ao trocar de marketplace ──────────────────
  // Quando o usuário troca de marketplace, voltamos sempre ao modo padrão.
  // Isso evita a situação onde as dimensões do marketplace anterior são
  // aplicadas inadvertidamente no novo (ex: trocar de Amazon para Shopee
  // mantendo 1000x1000 ao invés de usar 1024x1024).
  useEffect(() => {
    setDimensionMode('preset');
    setCustomWidth(selectedRules.size.width);
    setCustomHeight(selectedRules.size.height);
    onDimensionsChange(null); // null = usar o padrão do marketplace
  }, [selected, onDimensionsChange, selectedRules.size.height, selectedRules.size.width]);

  // ─── Renderização ─────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-8">

      {/* ── Seção 1: Grade de marketplaces ───────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h3 className="text-gray-100 font-sora text-base">
            Marketplace de Destino
          </h3>
          <p className="text-xs text-muted">Escolha o canal de venda</p>
        </div>

        {/*
          Grade de cards — um por marketplace.
          Cada card tem:
            - Botão principal (seleciona o marketplace ao clicar)
            - Botão de info no canto superior direito (abre painel de requisitos)
            - Badge de check quando está selecionado
        */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {marketplaceOrder.map((id) => {
            const marketplace = marketplaceRules[id];
            // O card só aparece como "selecionado" no modo padrão.
            // No modo personalizado, nenhum card fica destacado.
            const isSelected =
              dimensionMode === 'preset' && selected === marketplace.id;

            const brandColor = marketplace.color.primary;
            const brandShadow = marketplace.color.shadow;

            // O Shopee tem cor amarela (#FFE600), que pede texto escuro para contraste.
            const isLightBrand = brandColor.toLowerCase() === '#ffe600';

            return (
              <div key={marketplace.id} className="relative">
                {/* Botão principal do card */}
                <motion.button
                  onClick={() => !disabled && onSelect(marketplace.id)}
                  disabled={disabled}
                  aria-label={`Selecionar ${marketplace.name}`}
                  whileHover={
                    !disabled && !isSelected
                      ? { boxShadow: `0 0 18px ${brandShadow}` }
                      : {}
                  }
                  whileTap={!disabled ? { scale: 0.98 } : {}}
                  className="w-full p-4 sm:p-5 rounded-2xl transition-all panel-surface"
                  style={{
                    backgroundColor: 'rgba(12, 18, 24, 0.85)',
                    border: `2px solid ${isSelected ? brandColor : 'rgba(255, 255, 255, 0.08)'}`,
                    boxShadow: isSelected
                      ? `0 0 0 1px ${brandColor}30, 0 8px 24px ${brandShadow}`
                      : 'none',
                  }}
                >
                  <div className="flex flex-col items-center gap-3">
                    {/* Logo do marketplace em fundo branco para garantir visibilidade */}
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white">
                      <img
                        src={marketplace.logo}
                        alt={marketplace.name}
                        className="w-8 h-8 object-contain"
                      />
                    </div>

                    <div className="text-center">
                      <p
                        className="font-semibold"
                        style={{
                          color: isSelected ? brandColor : '#E5E7EB',
                        }}
                      >
                        {marketplace.name}
                      </p>

                      <p
                        className="text-xs"
                        style={{
                          color: isSelected
                            ? `${brandColor}aa`
                            : 'rgba(229,231,235,0.6)',
                        }}
                      >
                        {marketplace.dimensions}
                      </p>
                    </div>
                  </div>

                  {/* Badge de check — aparece apenas no card selecionado */}
                  {isSelected && (
                    <div
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Check
                        className="w-4 h-4"
                        color={isLightBrand ? '#1F2937' : '#FFFFFF'}
                      />
                    </div>
                  )}
                </motion.button>

                {/* Botão de info (ⓘ) — abre/fecha o painel de requisitos desse marketplace */}
                <button
                  onClick={() =>
                    setShowInfo(
                      showInfo === marketplace.id ? null : marketplace.id
                    )
                  }
                  aria-label={`Requisitos ${marketplace.name}`}
                  className="absolute top-2 right-2 w-11 h-11 sm:w-7 sm:h-7 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor:
                      showInfo === marketplace.id
                        ? brandColor
                        : 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Info
                    className="w-4 h-4"
                    color={
                      showInfo === marketplace.id
                        ? isLightBrand
                          ? '#1F2937'
                          : '#FFFFFF'
                        : '#9CA3AF'
                    }
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/*
          Painel de requisitos — animado com AnimatePresence.
          Aparece abaixo dos cards quando o usuário clica em ⓘ.
          Lista os requisitos técnicos do marketplace selecionado para info.
        */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-xl panel-outline"
            >
              <div className="p-5">
                <h4 className="font-semibold text-sm mb-3 text-gray-100">
                  Requisitos - {marketplaceRules[showInfo].name}
                </h4>
                <ul className="space-y-2">
                  {marketplaceRules[showInfo].requirements.map((req, index) => (
                    <li
                      key={index}
                      className="text-xs text-gray-300 flex gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Seção 2: Controle de dimensões ───────────────────────────────── */}
      <section className="p-4 sm:p-5 rounded-2xl border border-white/10 panel-surface">
        <h4 className="text-sm font-semibold mb-4 text-gray-100">
          Dimensão da imagem
        </h4>

        {/* Botões de alternância entre modo Padrão e Personalizado */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Modo Padrão: usa as dimensões definidas em marketplaceRules */}
          <button
            onClick={() => {
              setDimensionMode('preset');
              onDimensionsChange(null); // null = sinaliza para ProcessorView usar o padrão
            }}
            className={`px-4 py-3 rounded-full text-xs font-semibold ${
              dimensionMode === 'preset'
                ? 'btn-primary'
                : 'bg-white/10 text-gray-300'
            }`}
          >
            Padrão
          </button>

          {/* Modo Personalizado: ativa os inputs de largura e altura */}
          <button
            onClick={() => {
              setDimensionMode('custom');
              onDimensionsChange({
                width: customWidth,
                height: customHeight,
              });
            }}
            className={`px-4 py-3 rounded-full text-xs font-semibold ${
              dimensionMode === 'custom'
                ? 'btn-primary'
                : 'bg-white/10 text-gray-300'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/*
          Inputs de dimensão personalizada — visíveis apenas no modo 'custom'.
          Limites: mínimo 1px, máximo 4096px.
          O limite de 4096px evita que o navegador trave ao tentar criar um
          canvas muito grande (ex: 9999x9999 consumiria centenas de MB de RAM).
        */}
        {dimensionMode === 'custom' && (
          <>
            <div className="flex flex-col sm:flex-row gap-5 items-center">
              {/* Input de largura */}
              <input
                type="number"
                value={customWidth}
                min={1}
                max={4096}
                onChange={(e) => {
                  // Math.min/max garante que o valor nunca saia dos limites,
                  // mesmo que o usuário digite diretamente no campo.
                  const v = Math.min(4096, Math.max(1, Number(e.target.value)));
                  setCustomWidth(v);
                  onDimensionsChange({ width: v, height: customHeight });
                }}
                className="w-full px-3 py-3 border border-white/10 rounded-lg text-sm input-field"
                placeholder="Largura"
              />

              <span className="font-semibold hidden sm:inline text-gray-400">
                x
              </span>

              {/* Input de altura */}
              <input
                type="number"
                value={customHeight}
                min={1}
                max={4096}
                onChange={(e) => {
                  const v = Math.min(4096, Math.max(1, Number(e.target.value)));
                  setCustomHeight(v);
                  onDimensionsChange({ width: customWidth, height: v });
                }}
                className="w-full px-3 py-3 border border-white/10 rounded-lg text-sm input-field"
                placeholder="Altura"
              />
            </div>

            {/*
              Aviso de dimensão fora do padrão.
              Card destacado com borda amarela para ser facilmente visível.
              Imagens fora do padrão podem ser reprovadas automaticamente
              pelo sistema de revisão do marketplace.
            */}
            <div
              className="mt-4 p-3 rounded-lg flex gap-2 items-start"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.08)',
                borderLeft: '3px solid #eab308',
              }}
            >
              <AlertCircle
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                style={{ color: '#eab308' }}
              />
              <p className="text-xs font-medium" style={{ color: '#fef08a' }}>
                Dimensões fora do padrão (máx. 4096px) podem causar reprovação. Use o padrão quando possível.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
