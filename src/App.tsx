import React, { useState } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { AppHeader } from './components/Layout/AppHeader';
import { TerminalView } from './components/Terminal/TerminalView';
import { DualPaneExplorer } from './components/FileManager/DualPaneExplorer';
import { TransferDrawer } from './components/FileManager/TransferDrawer';
import { NewConnectionModal } from './components/Modal/NewConnectionModal';
import { SessionConfig } from './types';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    activeSessions,
    currentSessionId,
    viewMode,
    connectSession,
    isConnecting,
    error,
    clearError,
  } = useSessionStore();

  const currentSession = activeSessions.find((s) => s.id === currentSessionId);

  const handleConnect = async (config: SessionConfig) => {
    try {
      await connectSession(config);
      setIsModalOpen(false);
    } catch (e) {
      // Error is set in store
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <AppHeader onOpenNewConnection={() => setIsModalOpen(true)} />

      {/* Main Multi-Pane Viewport */}
      <main className="flex flex-1 overflow-hidden relative">
        {viewMode === 'terminal' && (
          <div className="flex-1 h-full w-full p-1">
            <TerminalView
              sessionId={currentSessionId}
              sessionName={currentSession?.name}
            />
          </div>
        )}

        {viewMode === 'sftp' && (
          <div className="flex-1 h-full w-full">
            <DualPaneExplorer sessionId={currentSessionId} />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="flex flex-1 h-full w-full overflow-hidden divide-x divide-slate-800">
            {/* Terminal Left Half */}
            <div className="flex-1 h-full min-w-0 p-1">
              <TerminalView
                sessionId={currentSessionId}
                sessionName={currentSession?.name}
              />
            </div>
            {/* Dual SFTP Explorer Right Half */}
            <div className="flex-1 h-full min-w-0">
              <DualPaneExplorer sessionId={currentSessionId} />
            </div>
          </div>
        )}
      </main>

      {/* Background File Transfer Drawer */}
      <TransferDrawer />

      {/* New Connection Modal */}
      <NewConnectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          clearError();
        }}
        onConnect={handleConnect}
        isLoading={isConnecting}
        error={error}
      />
    </div>
  );
}
