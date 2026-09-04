import React, { useEffect } from 'react';
import { useFileManagerStore } from '../../stores/fileManagerStore';
import { useTransferStore } from '../../stores/transferStore';
import { FilePane } from './FilePane';
import { ArrowRightLeft, Download, Upload } from 'lucide-react';

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
    // Initial load for local directory
    if (!local.currentPath) {
      loadLocalDir('~');
    }
  }, [local.currentPath, loadLocalDir]);

  useEffect(() => {
    // Initial load for remote directory if session is connected
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
    // Refresh local pane
    loadLocalDir(local.currentPath);
  };

  const handleUpload = async () => {
    if (!sessionId) return;
    for (const localFile of local.selectedPaths) {
      const fileName = localFile.split('/').pop() || 'uploaded_file';
      const destRemote = `${remote.currentPath}/${fileName}`;
      await startUpload(sessionId, localFile, destRemote);
    }
    // Refresh remote pane
    loadRemoteDir(sessionId, remote.currentPath);
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 overflow-hidden">
      <div className="flex flex-1 overflow-hidden p-1 space-x-1">
        {/* Local Pane */}
        <FilePane
          title="Local Files"
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

        {/* Transfer Action Column */}
        <div className="flex flex-col items-center justify-center space-y-2 px-1 py-2 shrink-0">
          <button
            onClick={handleUpload}
            disabled={!sessionId || local.selectedPaths.length === 0}
            className="flex items-center justify-center p-2 rounded bg-slate-800 text-slate-300 hover:bg-sky-600 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-300"
            title="Upload selected local files to remote"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            disabled={!sessionId || remote.selectedPaths.length === 0}
            className="flex items-center justify-center p-2 rounded bg-slate-800 text-slate-300 hover:bg-sky-600 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-300"
            title="Download selected remote files to local"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        {/* Remote Pane */}
        {sessionId ? (
          <FilePane
            title="Remote SFTP"
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
          <div className="flex flex-1 flex-col items-center justify-center rounded border border-dashed border-slate-800 bg-slate-900/20 text-slate-500 text-xs">
            <ArrowRightLeft className="mb-2 h-8 w-8 stroke-1 text-slate-700" />
            <p>Remote SFTP offline</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Connect to an SSH session to view remote files</p>
          </div>
        )}
      </div>
    </div>
  );
};
