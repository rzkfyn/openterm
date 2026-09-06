import { useState } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { useSavedConnectionStore } from './stores/savedConnectionStore';
import { AppHeader } from './components/Layout/AppHeader';
import { StatusBar } from './components/Layout/StatusBar';
import { TerminalView } from './components/Terminal/TerminalView';
import { DualPaneExplorer } from './components/FileManager/DualPaneExplorer';
import { TransferDrawer } from './components/FileManager/TransferDrawer';
import { NewConnectionModal, ModalMode } from './components/Modal/NewConnectionModal';
import { ConnectModal } from './components/Modal/ConnectModal';
import { Dashboard } from './components/Dashboard/Dashboard';
import { SessionConfig, SavedConnection } from './types';

export default function App() {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('new');
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [connectTarget, setConnectTarget] = useState<SavedConnection | null>(null);

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
          <main className="flex flex-1 overflow-hidden divide-x divide-[#2a2b38] bg-[#1e1e2d]">
            <div
              className={`h-full min-w-0 ${
                viewMode === 'terminal' ? 'flex-1' : viewMode === 'split' ? 'flex-1' : 'hidden'
              }`}
            >
              <TerminalView sessionId={currentSessionId} sessionName={currentSession?.name} />
            </div>
            <div
              className={`h-full min-w-0 ${
                viewMode === 'sftp' ? 'flex-1' : viewMode === 'split' ? 'flex-1' : 'hidden'
              }`}
            >
              <DualPaneExplorer sessionId={currentSessionId} />
            </div>
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
    </div>
  );
}
