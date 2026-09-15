import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { useSavedConnectionStore } from './stores/savedConnectionStore';
import { useUpdateStore } from './stores/updateStore';
import { useTotpStore } from './stores/totpStore';
import { AppHeader } from './components/Layout/AppHeader';
import { StatusBar } from './components/Layout/StatusBar';
import { TerminalView } from './components/Terminal/TerminalView';
import { DualPaneExplorer } from './components/FileManager/DualPaneExplorer';
import { ResizableSplitter } from './components/Common/ResizableSplitter';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { NewConnectionModal, ModalMode } from './components/Modal/NewConnectionModal';
import { ConnectModal } from './components/Modal/ConnectModal';
import { AppLockOverlay } from './components/Modal/AppLockOverlay';
import { SecurityOnboardingModal } from './components/Modal/SecurityOnboardingModal';
import { TotpModal } from './components/Modal/TotpModal';
import { SettingsModal } from './components/Modal/SettingsModal';
import { Dashboard } from './components/Dashboard/Dashboard';
import { SessionConfig, SavedConnection } from './types';
import { useBiometricStore } from './stores/biometricStore';
import { useThemeStore, applyThemeToDOM } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';

export default function App() {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('new');
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [connectTarget, setConnectTarget] = useState<SavedConnection | null>(null);

  // App Lock 2FA & Biometric state
  const [isAppLocked, setIsAppLocked] = useState(false);
  const totpConfig = useTotpStore((state) => state.config);
  const loadTotpConfig = useTotpStore((state) => state.loadConfig);
  const isTotpModalOpen = useTotpStore((state) => state.isModalOpen);
  const openTotpModal = useTotpStore((state) => state.openModal);
  const closeTotpModal = useTotpStore((state) => state.closeModal);
  const isBiometricEnabled = useBiometricStore((state) => state.isEnabled);
  const checkBiometricAvailability = useBiometricStore((state) => state.checkAvailability);
  const lastActivityRef = useRef<number>(Date.now());

  const [securityGate, setSecurityGate] = useState<{
    conn: SavedConnection;
    config?: SessionConfig;
  } | null>(null);

  // Theme synchronization
  const currentThemeId = useThemeStore((state) => state.currentThemeId);
  useEffect(() => {
    applyThemeToDOM(currentThemeId);
  }, [currentThemeId]);

  // Global keyboard shortcut: Cmd+, or Ctrl+, opens Settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        useSettingsStore.getState().openSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check 2FA config on launch
  useEffect(() => {
    checkBiometricAvailability();
    loadTotpConfig().then((cfg) => {
      const bioEnabled = useBiometricStore.getState().isEnabled;
      if (cfg.enabled || bioEnabled) {
        setIsAppLocked(true);
      }
    });
    useUpdateStore.getState().checkForUpdates();
  }, [loadTotpConfig, checkBiometricAvailability]);

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
      const isProtected = totpConfig?.enabled || isBiometricEnabled;
      if (!isProtected || isAppLocked) return;
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
  }, [totpConfig, isBiometricEnabled, isAppLocked]);

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
    const isSecured = Boolean(totpConfig?.enabled || isBiometricEnabled);
    if (!isSecured) {
      setSecurityGate({ conn });
      return;
    }
    await saveConnection(conn);
    setIsNewModalOpen(false);
  };

  const handleSaveAndConnect = async (conn: SavedConnection, config: SessionConfig) => {
    const isSecured = Boolean(totpConfig?.enabled || isBiometricEnabled);
    if (!isSecured) {
      setSecurityGate({ conn, config });
      return;
    }
    try {
      await connectSession(config);
      await saveConnection(conn);
      setIsNewModalOpen(false);
    } catch {
      // Connection failed: do NOT save profile to disk.
      // Error is stored in sessionStore and displayed directly in NewConnectionModal.
    }
  };

  const handleSecuritySuccess = async () => {
    if (!securityGate) return;
    const { conn, config } = securityGate;
    setSecurityGate(null);
    if (config) {
      try {
        await connectSession(config);
        await saveConnection(conn);
        setIsNewModalOpen(false);
      } catch {
        // Connection failed: do not save profile.
      }
    } else {
      await saveConnection(conn);
      setIsNewModalOpen(false);
    }
  };

  const handleConnectWithoutSaving = async () => {
    if (!securityGate?.config) return;
    const config = securityGate.config;
    setSecurityGate(null);
    setIsNewModalOpen(false);
    try {
      await connectSession(config);
    } catch {}
  };

  const handleDashboardConnect = async (conn: SavedConnection) => {
    if (isConnecting) return;
    clearError();
    const canAttemptDirect =
      (conn.authType === 'password' && Boolean(conn.password)) ||
      conn.authType === 'key';

    if (canAttemptDirect) {
      try {
        await connectSession({
          name: conn.name,
          host: conn.host,
          port: conn.port,
          username: conn.username,
          authType: conn.authType,
          password: conn.authType === 'password' ? conn.password : undefined,
          privateKeyPath: conn.authType === 'key' ? conn.privateKeyPath : undefined,
          passphrase: conn.authType === 'key' ? conn.passphrase : undefined,
          bookmarks: conn.bookmarks,
          quickCommands: conn.quickCommands,
        });
        return;
      } catch {
        // Direct connect failed (e.g. invalid/missing password or passphrase). Prompt user via modal.
      }
    }

    setConnectTarget(conn);
  };

  const handleConnect = async (config: SessionConfig) => {
    try {
      await connectSession(config);
      if (connectTarget) {
        const isSecured = Boolean(totpConfig?.enabled || isBiometricEnabled);
        if (isSecured) {
          if (connectTarget.password !== undefined && config.password !== undefined) {
            await saveConnection({ ...connectTarget, password: config.password });
          } else if (connectTarget.passphrase !== undefined && config.passphrase !== undefined) {
            await saveConnection({ ...connectTarget, passphrase: config.passphrase });
          }
        }
      }
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
                <ErrorBoundary fallbackTitle="Terminal Session Error">
                  <TerminalView sessionId={currentSessionId} sessionName={currentSession?.name} />
                </ErrorBoundary>
              </div>
            )}

            {viewMode === 'sftp' && (
              <div className="h-full w-full min-w-0">
                <ErrorBoundary fallbackTitle="SFTP Explorer Error">
                  <DualPaneExplorer sessionId={currentSessionId} />
                </ErrorBoundary>
              </div>
            )}

            {viewMode === 'split' && (
              <>
                <div
                  style={{ width: `${terminalSplitPercent}%` }}
                  className="h-full min-w-[200px] overflow-hidden"
                >
                  <ErrorBoundary fallbackTitle="Terminal Session Error">
                    <TerminalView sessionId={currentSessionId} sessionName={currentSession?.name} />
                  </ErrorBoundary>
                </div>

                <ResizableSplitter onResize={handleSplitResize} />

                <div
                  style={{ width: `${100 - terminalSplitPercent}%` }}
                  className="h-full min-w-[200px] overflow-hidden"
                >
                  <ErrorBoundary fallbackTitle="SFTP Split Explorer Error">
                    <DualPaneExplorer sessionId={currentSessionId} />
                  </ErrorBoundary>
                </div>
              </>
            )}
          </main>
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

      {/* Security Onboarding Gate for Saving Credentials */}
      <SecurityOnboardingModal
        isOpen={Boolean(securityGate)}
        onClose={() => setSecurityGate(null)}
        onSuccess={handleSecuritySuccess}
        onSetupTotp={() => openTotpModal()}
        onConnectTransient={handleConnectWithoutSaving}
        canConnectTransient={Boolean(securityGate?.config)}
      />

      {/* App Security & 2FA Modal */}
      <TotpModal
        isOpen={isTotpModalOpen}
        config={totpConfig}
        onClose={closeTotpModal}
        onConfigChange={async () => {
          const cfg = await loadTotpConfig();
          if (cfg.enabled && securityGate) {
            handleSecuritySuccess();
          }
        }}
      />

      {/* Preferences & Settings Modal */}
      <SettingsModal
        onOpenTotpModal={() => openTotpModal()}
      />
    </div>
  );
}
