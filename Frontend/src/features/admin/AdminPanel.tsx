import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Image, ShieldAlert, Plus, Ban, Trash2, BarChart3, RefreshCw, X, Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl, fetchWithAuth } from '../../shared/services/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@radix-ui/react-alert-dialog';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
  _count: { images: number };
}

interface Stats {
  totalUsers: number;
  totalImages: number;
  totalLeads: number;
  imagesByMarketplace: { marketplace: string; count: number }[];
  recentUsers: AdminUser[];
}

const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  magazineluiza: 'Magazine Luiza',
  americanas: 'Americanas',
};

const MARKETPLACE_COLORS: Record<string, string> = {
  amazon: '#FF9900',
  mercadolivre: '#FFE600',
  shopee: '#EE4D2D',
  magazineluiza: '#0086FF',
  americanas: '#E50303',
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stats' | 'users'>('stats');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetchWithAuth(buildApiUrl('/admin/users')),
        fetchWithAuth(buildApiUrl('/admin/stats')),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleBlock = async (user: AdminUser) => {
    try {
      const res = await fetchWithAuth(buildApiUrl(`/admin/users/${user.id}/block`), {
        method: 'PATCH', headers: JSON_HEADERS,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u));
      toast.success(user.isBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = (user: AdminUser) => {
    setDeleteTarget(user);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const user = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetchWithAuth(buildApiUrl(`/admin/users/${user.id}`), {
        method: 'DELETE', headers: JSON_HEADERS,
      });
      if (!res.ok && res.status !== 204) { const e = await res.json(); throw new Error(e.error); }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success('Usuário excluído');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetchWithAuth(buildApiUrl('/admin/users'), {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((prev) => [{ ...data, isAdmin: false, isBlocked: false, _count: { images: 0 } }, ...prev]);
      setForm({ name: '', email: '' });
      setShowCreate(false);
      toast.success('Usuário criado com sucesso');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const STAT_CARDS = stats ? [
    { label: 'Clientes', value: stats.totalUsers, icon: Users, color: '#7cff4e' },
    { label: 'Imagens Processadas', value: stats.totalImages, icon: Image, color: '#3b82f6' },
    { label: 'Leads Captados', value: stats.totalLeads, icon: TrendingUp, color: '#a855f7' },
  ] : [];

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#0c151b',
        backgroundImage: `linear-gradient(to right,rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.04) 1px,transparent 1px)`,
        backgroundSize: '45px 45px',
      }}
    >
      <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[#7cff4e] opacity-[0.06] blur-[180px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <span className="inline-flex px-3 py-1 rounded-full border border-[#7cff4e]/20 bg-[#7cff4e]/10 text-[#7cff4e] text-xs font-bold uppercase tracking-widest">Admin</span>
            <h2 className="text-white text-2xl sm:text-3xl font-bold mt-3">Painel Administrativo</h2>
          </div>
          <button onClick={load} className="p-3 min-h-[44px] min-w-[44px] rounded-xl text-zinc-400 hover:text-white transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(['stats', 'users'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                backgroundColor: tab === t ? '#7cff4e' : 'rgba(255,255,255,0.05)',
                color: tab === t ? '#000' : '#94a3b8',
              }}
            >
              {t === 'stats' ? 'Estatísticas' : 'Clientes'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#7cff4e]" />
          </div>
        ) : tab === 'stats' ? (
          <div className="space-y-8">
            {/* Cards de stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STAT_CARDS.map((card) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4 sm:p-6"
                  style={{ backgroundColor: '#131d25', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.color + '22' }}>
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <span className="text-zinc-400 text-sm">{card.label}</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Imagens por marketplace */}
            {stats && stats.imagesByMarketplace.length > 0 && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#131d25', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-5 h-5 text-[#7cff4e]" />
                  <h3 className="text-white font-semibold">Imagens por Marketplace</h3>
                </div>
                <div className="space-y-3">
                  {stats.imagesByMarketplace.map(({ marketplace, count }) => {
                    const pct = Math.round((count / stats.totalImages) * 100);
                    const color = MARKETPLACE_COLORS[marketplace] || '#7cff4e';
                    return (
                      <div key={marketplace}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-300">{MARKETPLACE_LABELS[marketplace] || marketplace}</span>
                          <span className="text-zinc-400">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clientes recentes */}
            {stats && stats.recentUsers.length > 0 && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#131d25', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="text-white font-semibold mb-4">Últimos Cadastros</h3>
                <div className="space-y-3">
                  {stats.recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm text-white font-medium truncate max-w-[180px]">{u.name}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.isBlocked && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Bloqueado</span>}
                        <span className="text-xs text-zinc-500">
                          {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                style={{ backgroundColor: '#7cff4e', color: '#000' }}
              >
                <Plus className="w-4 h-4" /> Novo cliente
              </button>
            </div>

            {/* Form criar usuário */}
            {showCreate && (
              <motion.form
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                onSubmit={handleCreate}
                className="rounded-2xl p-5 space-y-3"
                style={{ backgroundColor: '#131d25', border: '1px solid rgba(124,255,78,0.2)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-semibold">Criar novo cliente</h3>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder="Nome completo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="px-3 py-3 rounded-xl text-sm text-white bg-black/30 border border-white/10 outline-none focus:border-[#7cff4e]" />
                  <input required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="px-3 py-3 rounded-xl text-sm text-white bg-black/30 border border-white/10 outline-none focus:border-[#7cff4e]" />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={creating}
                    className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: '#7cff4e', color: '#000' }}
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar cliente
                  </button>
                </div>
              </motion.form>
            )}

            {/* Tabela */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#131d25', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { label: 'Cliente', className: '' },
                        { label: 'E-mail', className: 'hidden sm:table-cell' },
                        { label: 'Imagens', className: 'hidden md:table-cell' },
                        { label: 'Cadastro', className: 'hidden md:table-cell' },
                        { label: 'Status', className: '' },
                        { label: 'Ações', className: '' },
                      ].map((h) => (
                        <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider ${h.className}`}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#7cff4e22', color: '#7cff4e' }}>
                              {user.name[0]?.toUpperCase()}
                            </div>
                            <span className="text-white font-medium">{user.name}</span>
                            {user.isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7cff4e]/10 text-[#7cff4e] border border-[#7cff4e]/20 font-bold">ADMIN</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">{user.email}</td>
                        <td className="px-4 py-3 text-zinc-300 hidden md:table-cell">{user._count.images}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.isBlocked ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {user.isBlocked ? 'Bloqueado' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!user.isAdmin && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleToggleBlock(user)} title={user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                aria-label={user.isBlocked ? 'Desbloquear usuário' : 'Bloquear usuário'}
                                className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                              >
                                {user.isBlocked
                                  ? <ShieldAlert className="w-4 h-4 text-emerald-400" />
                                  : <Ban className="w-4 h-4 text-orange-400" />}
                              </button>
                              <button onClick={() => handleDelete(user)} title="Excluir" aria-label={`Excluir ${user.name}`} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="text-center py-8 text-zinc-500 text-sm">Nenhum cliente encontrado.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
              Excluir cliente?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>
              O cliente <strong style={{ color: 'white' }}>{deleteTarget?.name}</strong> e todos os seus dados serão removidos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
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
              onClick={confirmDelete}
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
              Sim, excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
