/**
 * shared/components/layout/MainHeader.tsx
 *
 * Cabeçalho principal da aplicação autenticada.
 *
 * O que este arquivo faz:
 *  - Exibe o logo clicável (redireciona para a view de processamento).
 *  - Renderiza navegação entre as duas views disponíveis: Processar e Histórico.
 *  - Mostra o primeiro nome do usuário autenticado (lido do localStorage).
 *  - Exibe contador no badge do Histórico quando há itens processados.
 *  - Oferece botão de logout com feedback visual.
 *
 * Responsividade:
 *  - Mobile: logo e nome do usuário em linha (MD oculto); nav e logout abaixo.
 *  - Desktop (md+): tudo em uma linha horizontal com separador visual.
 *
 * Por que `useMemo` para `userName`?
 *  - `localStorage.getItem` com parse de JSON é executado a cada renderização sem memo.
 *    Em um header sticky (re-renderizado com frequência), vale cachear o parse.
 */
import { useMemo } from 'react';
import { Upload, History, LogOut, User, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../../../assets/logo.png';

interface MainHeaderProps {
  currentView: 'processor' | 'history' | 'admin';
  onViewChange: (view: 'processor' | 'history') => void;
  onAdminView?: () => void;
  onLogout: () => void;
  historyCount: number;
  isAdmin?: boolean;
}

export function MainHeader({
  currentView,
  onViewChange,
  onAdminView,
  onLogout,
  historyCount,
  isAdmin,
}: MainHeaderProps) {
  // ─── Nome do usuário ───────────────────────────────────────────────────────

  // Lê e parseia uma única vez por render cycle — evita parse repetido no header sticky.
  const userName = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return 'Operador';
      const user = JSON.parse(rawUser) as { name?: string; email?: string };
      const name = user.name || user.email || 'Operador';
      // Apenas o primeiro nome para não quebrar o layout em telas pequenas.
      return name.split(' ')[0];
    } catch {
      return 'Operador';
    }
  }, []);

  // ─── Utilitário de estilo de navegação ────────────────────────────────────

  /**
   * Retorna classes do botão de navegação conforme estado ativo/inativo.
   * @param isActive `true` quando a view correspondente está selecionada.
   * @returns String de classes Tailwind.
   */
  const navButtonClass = (isActive: boolean) =>
    `relative px-4 sm:px-5 py-3 font-medium flex items-center gap-2 rounded-lg transition-all duration-200 text-sm sm:text-base ${
      isActive
        ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/5'
        : 'text-zinc-400 hover:text-white hover:bg-white/5'
    }`;

  // ─── Renderização ──────────────────────────────────────────────────────────

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0c151b]/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* ── Logo + nome (mobile) ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => onViewChange('processor')}
            className="flex items-center group"
            title="Voltar para processamento"
          >
            <img
              src={logo}
              alt="ImagePro Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain transition-transform group-hover:scale-105"
            />
          </button>

          {/* Nome do usuário exibido apenas em mobile (md: oculto). */}
          <div className="flex sm:hidden items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-200">{userName}</span>
          </div>
        </div>

        {/* ── Área de ações ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-4 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">

          {/* Navegação entre views encapsulada em container com fundo. */}
          <nav className="flex items-center bg-black/20 p-1 rounded-xl border border-white/5">
            <motion.button
              onClick={() => onViewChange('processor')}
              whileTap={{ scale: 0.97 }}
              className={navButtonClass(currentView === 'processor')}
            >
              <Upload className="w-4 h-4" />
              <span>Processar</span>
            </motion.button>

            <motion.button
              onClick={() => onViewChange('history')}
              whileTap={{ scale: 0.97 }}
              className={navButtonClass(currentView === 'history')}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
              {/* Badge com contagem — oculto quando vazio. */}
              {historyCount > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                  {historyCount > 9 ? '9+' : historyCount}
                </span>
              )}
            </motion.button>
          </nav>

          {/* Botão Admin — visível apenas para administradores */}
          {isAdmin && (
            <motion.button
              onClick={onAdminView}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className={`px-3 py-3 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${currentView === 'admin' ? 'bg-[#7cff4e] text-[#0c151b]' : 'bg-[#7cff4e]/10 text-[#7cff4e] border border-[#7cff4e]/20 hover:bg-[#7cff4e]/20'}`}
              title="Painel Admin"
              aria-label="Painel administrativo"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </motion.button>
          )}

          {/* Separador vertical — visível apenas em desktop. */}
          <div className="hidden sm:block w-px h-8 bg-white/10 mx-1" />

          {/* Nome do usuário em desktop (oculto em mobile). */}
          <div className="hidden sm:flex flex-col text-right mr-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Ativo
            </span>
            <span className="text-sm text-zinc-200 font-medium truncate max-w-[120px]">
              {userName}
            </span>
          </div>

          {/* Botão de logout. */}
          <motion.button
            onClick={onLogout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-3 min-h-[44px] rounded-full font-medium flex items-center gap-2 transition-colors text-sm border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 whitespace-nowrap"
            title="Sair do sistema"
            aria-label="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
