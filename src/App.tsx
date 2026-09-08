import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { useSavedConnectionStore } from './stores/savedConnectionStore';
import { useUpdateStore } from './stores/updateStore';
import { useTotpStore } from './stores/totpStore';
import { AppHeader } from './components/Layout/AppHeader';
import { StatusBar } from './components/Layout/StatusBar';
import { TerminalView } from './components/Terminal/TerminalView';
import { DualPaneExplorer } from './components/FileManager/DualPaneExplorer';
import { TransferDrawer } from './components/FileManager/TransferDrawer';
import { ResizableSplitter } from './components/Common/ResizableSplitter';
import { NewConnectionModal, ModalMode } from './components/Modal/NewConnectionModal';
import { ConnectModal } from './components/Modal/ConnectModal';
import { AppLockOverlay } from './components/Modal/AppLockOverlay';
import { Dashboard } from './components/Dashboard/Dashboard';
import { SessionConfig, SavedConnection, TotpConfig } from './types';
import { tauriApi } from './services/tauri';

export default function App() {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('new');
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [connectTarget, setConnectTarget] = useState<SavedConnection | null>(null);

  // App Lock 2FA state
  const [isAppLocked, setIsAppLocked] = useState(false);
  const totpConfig = useTotpStore((state) => state.config);
  const loadTotpConfig = useTotpStore((state) => state.loadConfig);
  const lastActivityRef = useRef<number>(Date.now());

  // Check 2FA config on launch
  useEffect(() => {
    loadTotpConfig().then((cfg) => {
      if (cfg.enabled) {
        setIsAppLocked(true);
      }
    });
    useUpdateStore.getState().checkForUpdates();
  }, [loadTotpConfig]);

  // Idle timeout tracking
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('wheel', handleActivity);

    const interval = setInterval(() => {
      if (!totpConfig?.enabled || isAppLocked) return;
      const timeoutMins = totpConfig.idleTimeoutMins ?? 15;
      if (timeoutMins <= 0) return; // 0 = disabled

      const idleDuration = (Date.now() - lastActivityRef.current) / 1000 / 60;
      if (idleDuration >= timeoutMins) {
        setIsAppLocked(true);
      }
    }, 10_000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      clearInterval(interval);
    };
  }, [totpConfig, isAppLocked]);

  // Terminal vs SFTP split percentage (persisted)
  const [terminalSplitPercent, setTerminalSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('openterm_terminal_split_percent');
    return saved ? Math.max(20, Math.min(80, parseFloat(saved))) : 50;
  });
  const mainRef = useRef<HTMLDivElement>(null);

  const handleSplitResize = (deltaX: number) => {
    if (!mainRef.current) return;
    const totalWidth = mainRef.current.clientWidth;
    if (totalWidth <= 0) return;
    const deltaPercent = (deltaX / totalWidth) * 100;
    setTerminalSplitPercent((prev) => {
      const next = Math.max(20, Math.min(80, prev + deltaPercent));
      localStorage.setItem('openterm_terminal_split_percent', next.toFixed(1));
      return next;
    });
  };

  const {
    activeSessions,
    currentSessionId,
    viewMode,
    connectSession,
    isConnecting,
    error,
    clearError,
  } = useSessionStore();

  const { save: saveConnection } = useSavedConnectionStore();

  const currentSession = activeSessions.find((s) => s.id === currentSessionId);

  const openNewModal = () => {
    setModalMode('new');
    setEditingConnection(null);
    clearError();
    setIsNewModalOpen(true);
  };

  const openEditModal = (conn: SavedConnection) => {
    setModalMode('edit');
    setEditingConnection(conn);
    clearError();
    setIsNewModalOpen(true);
  };

  const handleSaveOnly = async (conn: SavedConnection) => {
    await saveConnection(conn);
    setIsNewModalOpen(false);
  };

  const handleSaveAndConnect = async (conn: SavedConnection, config: SessionConfig) => {
    await saveConnection(conn);
    try {
      await connectSession(config);
      setIsNewModalOpen(false);
    } catch {
      // error shown in modal via store
    }
  };

  const handleDashboardConnect = (conn: SavedConnection) => {
    clearError();
    setConnectTarget(conn);
  };

  const handleConnect = async (config: SessionConfig) => {
    try {
      await connectSession(config);
      setConnectTarget(null);
    } catch {
      // error shown in modal
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#11111a] text-slate-200 overflow-hidden select-none font-sans">
      <AppHeader onOpenNewConnection={openNewModal} />

      {/* Main Workspace or Dashboard */}
      {!currentSessionId ? (
        <main className="flex-1 overflow-hidden bg-[#11111a]">
          <Dashboard
            onNewConnection={openNewModal}
            onConnect={handleDashboardConnect}
            onEdit={openEditModal}
          />
        </main>
      ) : (
        <>
          <main ref={mainRef} className="flex flex-1 overflow-hidden bg-[#1e1e2d] relative">
            {viewMode === 'terminal' && (
              <div className="h-full w-full min-w-0">
                <TerminalView sessionId={currentSessionId} sessionName={currentSession?.name} />
              </div>
            )}

            {viewMode === 'sftp' && (
              <div className="h-full w-full min-w-0">
                <DualPaneExplorer sessionId={currentSessionId} />
              </div>
            )}

            {viewMode === 'split' && (
              <>
                <div
                  style={{ width: `${terminalSplitPercent}%` }}
                  className="h-full min-w-[200px] overflow-hidden"
                >
                  <TerminalView sessionId={currentSessionId} sessionName={currentSession?.name} />
                </div>

                <ResizableSplitter onResize={handleSplitResize} />

                <div
                  style={{ width: `${100 - terminalSplitPercent}%` }}
                  className="h-full min-w-[200px] overflow-hidden"
                >
                  <DualPaneExplorer sessionId={currentSessionId} />
                </div>
              </>
            )}
          </main>
          <TransferDrawer />
        </>
      )}

      {/* Clean Bottom Status Bar */}
      <StatusBar />

      <NewConnectionModal
        isOpen={isNewModalOpen}
        mode={modalMode}
        editingConnection={editingConnection}
        onClose={() => {
          setIsNewModalOpen(false);
          clearError();
        }}
        onSave={handleSaveOnly}
        onSaveAndConnect={handleSaveAndConnect}
        isLoading={isConnecting}
        error={error}
      />

      <ConnectModal
        isOpen={!!connectTarget}
        connection={connectTarget}
        onClose={() => {
          setConnectTarget(null);
          clearError();
        }}
        onConnect={handleConnect}
        isLoading={isConnecting}
        error={error}
      />

      {/* 2FA App Lock Shield */}
      <AppLockOverlay
        isOpen={isAppLocked}
        onUnlock={() => {
          setIsAppLocked(false);
          lastActivityRef.current = Date.now();
        }}
      />
    </div>
  );
}
