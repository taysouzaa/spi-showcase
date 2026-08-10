import { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from '../features/auth/LoginScreen';
import { MainHeader } from '../shared/components/layout/MainHeader';
import { Toaster } from 'sonner';
import { ProcessorView } from '../features/processing/ProcessorView';
import { HistoryPanel } from '../features/history/HistoryPanel';
import { AdminPanel } from '../features/admin/AdminPanel';
import { useAuth } from '../shared/hooks/useAuth';
import { useHistory } from '../shared/hooks/useHistory';

type AppView = 'login' | 'processor' | 'history' | 'admin';

const VIEW_STORAGE_KEY = 'spi-view';

const readStoredView = (): AppView => {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === 'history' || raw === 'processor' ? raw : 'processor';
  } catch {
    return 'processor';
  }
};

const writeStoredView = (view: AppView) => {
  try {
    if (view === 'processor' || view === 'history') {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    }
  } catch {
    // ignore
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');

  const handleLogoutSideEffects = useCallback(() => {
    setCurrentView('login');
  }, []);

  const { isAuthenticated, isAdmin, login, logout, initFromStorage } = useAuth(
    undefined,
    handleLogoutSideEffects,
  );

  const {
    history,
    init: initHistory,
    loadHistoryFromBackend,
    handleImageProcessed,
    handleUploadComplete,
    handleDownloadFromHistory,
    handleDeleteFromHistory,
    handleClearHistory,
    handleUpdateHistoryItem,
  } = useHistory(isAuthenticated, logout);

  useEffect(() => {
    const hasToken = initFromStorage();
    if (hasToken) {
      setCurrentView(readStoredView());
      initHistory();
    }
  }, [initFromStorage, initHistory]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeStoredView(currentView);
  }, [currentView, isAuthenticated]);

  const handleLogin = useCallback(() => {
    login();
    setCurrentView('processor');
    writeStoredView('processor');
    initHistory();
  }, [login, initHistory]);

  const handleViewChange = useCallback(
    (view: 'processor' | 'history') => {
      setCurrentView(view);
      writeStoredView(view);
      if (view === 'history') loadHistoryFromBackend();
    },
    [loadHistoryFromBackend],
  );

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onEnter={handleLogin} />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-grid min-h-screen flex flex-col">
        <MainHeader
          currentView={currentView as 'processor' | 'history' | 'admin'}
          onViewChange={handleViewChange}
          onAdminView={() => setCurrentView('admin')}
          onLogout={logout}
          historyCount={history.length}
          isAdmin={isAdmin}
        />

        <main className="flex-1 w-full">
          {currentView === 'processor' && (
            <ProcessorView
              onImageProcessed={handleImageProcessed}
              onUploadComplete={handleUploadComplete}
            />
          )}
          {currentView === 'history' && (
            <HistoryPanel
              history={history}
              onDownload={handleDownloadFromHistory}
              onDelete={handleDeleteFromHistory}
              onClearAll={handleClearHistory}
              onUpdateItem={handleUpdateHistoryItem}
            />
          )}
          {currentView === 'admin' && isAdmin && <AdminPanel />}
        </main>

      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
