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
      // Error handled in store
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col bg-[#030712] text-slate-100 overflow-hidden bg-noise">
      {/* Background Ambient Radial Glow */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* High-End Floating Navbar Header */}
      <AppHeader onOpenNewConnection={() => setIsModalOpen(true)} />

      {/* Main Responsive Asymmetrical & Split Workspace */}
      <main className="relative z-10 flex flex-1 overflow-hidden">
        {viewMode === 'terminal' && (
          <div className="flex-1 h-full w-full">
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
          <div className="flex flex-1 h-full w-full overflow-hidden divide-x divide-white/[0.04]">
            {/* Terminal Viewport */}
            <div className="flex-1 h-full min-w-0">
              <TerminalView
                sessionId={currentSessionId}
                sessionName={currentSession?.name}
              />
            </div>
            {/* Dual SFTP Explorer */}
            <div className="flex-1 h-full min-w-0">
              <DualPaneExplorer sessionId={currentSessionId} />
            </div>
          </div>
        )}
      </main>

      {/* Background Direct File Transfer Drawer */}
      <TransferDrawer />

      {/* Double-Bezel New Connection Dialog */}
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
