import React, { useEffect } from 'react';
import { useFileManagerStore } from '../../stores/fileManagerStore';
import { useTransferStore } from '../../stores/transferStore';
import { FilePane } from './FilePane';
import { ArrowRight, ArrowLeft, CloudOff } from 'lucide-react';

interface DualPaneExplorerProps {
  sessionId: string | null;
}

export const DualPaneExplorer: React.FC<DualPaneExplorerProps> = ({ sessionId }) => {
  const {
    local,
    remote,
    setLocalSelected,
    setRemoteSelected,
    loadLocalDir,
    loadRemoteDir,
  } = useFileManagerStore();

  const { startDownload, startUpload } = useTransferStore();

  useEffect(() => {
    if (!local.currentPath) {
      loadLocalDir('~');
    }
  }, [local.currentPath, loadLocalDir]);

  useEffect(() => {
    if (sessionId && !remote.currentPath) {
      loadRemoteDir(sessionId, '.');
    }
  }, [sessionId, remote.currentPath, loadRemoteDir]);

  const handleDownload = async () => {
    if (!sessionId) return;
    for (const remoteFile of remote.selectedPaths) {
      const fileName = remoteFile.split('/').pop() || 'downloaded_file';
      const destLocal = `${local.currentPath}/${fileName}`;
      await startDownload(sessionId, remoteFile, destLocal);
    }
    loadLocalDir(local.currentPath);
  };

  const handleUpload = async () => {
    if (!sessionId) return;
    for (const localFile of local.selectedPaths) {
      const fileName = localFile.split('/').pop() || 'uploaded_file';
      const destRemote = `${remote.currentPath}/${fileName}`;
      await startUpload(sessionId, localFile, destRemote);
    }
    loadRemoteDir(sessionId, remote.currentPath);
  };

  return (
    <div className="flex h-full w-full bg-[#030712] overflow-hidden p-1.5 space-x-2">
      {/* Local Pane */}
      <FilePane
        title="Local Machine"
        isRemote={false}
        currentPath={local.currentPath}
        entries={local.entries}
        total={local.total}
        isLoading={local.isLoading}
        error={local.error}
        selectedPaths={local.selectedPaths}
        onSelect={setLocalSelected}
        onNavigate={(p) => loadLocalDir(p)}
        onRefresh={() => loadLocalDir(local.currentPath)}
      />

      {/* Kinetic Transfer Action Bridge */}
      <div className="flex flex-col items-center justify-center space-y-3 px-1 shrink-0">
        <button
          onClick={handleUpload}
          disabled={!sessionId || local.selectedPaths.length === 0}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] hover:bg-emerald-500 hover:text-black border border-white/[0.08] text-slate-300 disabled:opacity-20 disabled:hover:bg-white/[0.04] disabled:hover:text-slate-300 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90"
          title="Upload to Remote Host (Push)"
        >
          <ArrowRight className="h-4 w-4 stroke-[2] transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={handleDownload}
          disabled={!sessionId || remote.selectedPaths.length === 0}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] hover:bg-cyan-500 hover:text-black border border-white/[0.08] text-slate-300 disabled:opacity-20 disabled:hover:bg-white/[0.04] disabled:hover:text-slate-300 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90"
          title="Download to Local Machine (Pull)"
        >
          <ArrowLeft className="h-4 w-4 stroke-[2] transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>

      {/* Remote Pane */}
      {sessionId ? (
        <FilePane
          title="Remote SFTP Server"
          isRemote={true}
          currentPath={remote.currentPath}
          entries={remote.entries}
          total={remote.total}
          isLoading={remote.isLoading}
          error={remote.error}
          selectedPaths={remote.selectedPaths}
          onSelect={setRemoteSelected}
          onNavigate={(p) => loadRemoteDir(sessionId, p)}
          onRefresh={() => loadRemoteDir(sessionId, remote.currentPath)}
        />
      ) : (
        <div className="flex flex-1 flex-col p-1 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="flex flex-1 flex-col items-center justify-center rounded-[calc(1.5rem-0.25rem)] bg-[#050811] border border-white/[0.04] text-center p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-3">
              <CloudOff className="h-6 w-6 stroke-[1.2] text-slate-500" />
            </div>
            <span className="rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-widest font-mono font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] mb-2">
              SFTP Standby
            </span>
            <p className="text-xs font-medium text-slate-300">Remote Session Offline</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Connect to an active SSH profile to mount the remote file system via SFTP.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
