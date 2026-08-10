/**
 * useAuth.ts
 * Hook de autenticação — gerencia estado de login/logout e dados do usuário.
 */
import { useState, useCallback } from 'react';
import { buildApiUrl, fetchWithAuth } from '../services/api';

const VIEW_STORAGE_KEY = 'spi-view';

function readIsAdminFromStorage(): boolean {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { isAdmin?: boolean }).isAdmin);
  } catch {
    return false;
  }
}

export function useAuth(onLogin?: () => void, onLogout?: () => void) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Verifica isAdmin diretamente no backend — evita que localStorage manipulado
  // conceda acesso indevido ao painel de administração.
  const verifySession = useCallback(async () => {
    try {
      const resp = await fetchWithAuth(buildApiUrl('/users/me'));
      if (resp.ok) {
        const user = await resp.json();
        const adminFlag = Boolean(user.isAdmin);
        setIsAdmin(adminFlag);
        // Mantém localStorage sincronizado com o valor real do servidor.
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...stored, isAdmin: adminFlag }));
        } catch {}
      } else if (resp.status === 401) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        localStorage.removeItem('user');
      }
    } catch {
      // Falha de rede: mantém o estado atual sem forçar logout.
    }
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    setIsAdmin(readIsAdminFromStorage());
    verifySession();
    onLogin?.();
  }, [onLogin, verifySession]);

  const logout = useCallback(() => {
    fetchWithAuth(buildApiUrl('/auth/logout'), { method: 'POST' }).catch(() => {});
    localStorage.removeItem('user');
    localStorage.removeItem(VIEW_STORAGE_KEY);
    setIsAuthenticated(false);
    setIsAdmin(false);
    onLogout?.();
  }, [onLogout]);

  const initFromStorage = useCallback(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setIsAuthenticated(true);
      setIsAdmin(readIsAdminFromStorage());
      verifySession();
      return true;
    }
    return false;
  }, [verifySession]);

  return {
    isAuthenticated,
    isAdmin,
    login,
    logout,
    initFromStorage,
  };
}
