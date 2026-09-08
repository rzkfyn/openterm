import React, { useEffect, useCallback } from 'react';
import { useFileManagerStore } from '../../stores/fileManagerStore';
import { useTransferStore } from '../../stores/transferStore';
import { tauriApi } from '../../services/tauri';
import { getBasename, joinLocalPath, joinRemotePath } from '../../utils/pathUtils';
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
    const paths = [...remote.selectedPaths];
    for (const remoteFile of paths) {
      const fileName = getBasename(remoteFile) || 'downloaded_file';
      const destLocal = joinLocalPath(local.currentPath, fileName);
      await startDownload(sessionId, remoteFile, destLocal);
    }
    loadLocalDir(local.currentPath);
  };

  const handleUpload = async () => {
    if (!sessionId) return;
    const paths = [...local.selectedPaths];
    for (const localFile of paths) {
      const fileName = getBasename(localFile) || 'uploaded_file';
      const destRemote = joinRemotePath(remote.currentPath, fileName);
      await startUpload(sessionId, localFile, destRemote);
    }
    loadRemoteDir(sessionId, remote.currentPath);
  };

  const handleDropTransfer = useCallback(
    async (
      targetIsRemote: boolean,
      source: 'local' | 'remote',
      paths: string[],
      targetFolder?: string
    ) => {
      if (!sessionId || paths.length === 0) return;

      if (targetIsRemote && source === 'local') {
        const destDir = targetFolder || remote.currentPath;
        for (const localFile of paths) {
          const fileName = getBasename(localFile) || 'file';
          const destRemote = joinRemotePath(destDir, fileName);
          await startUpload(sessionId, localFile, destRemote);
        }
        loadRemoteDir(sessionId, remote.currentPath);
      } else if (!targetIsRemote && source === 'remote') {
        const destDir = targetFolder || local.currentPath;
        for (const remoteFile of paths) {
          const fileName = getBasename(remoteFile) || 'file';
          const destLocal = joinLocalPath(destDir, fileName);
          await startDownload(sessionId, remoteFile, destLocal);
        }
        loadLocalDir(local.currentPath);
      }
    },
    [sessionId, local.currentPath, remote.currentPath, startUpload, startDownload, loadRemoteDir, loadLocalDir]
  );

  // Listen for native OS drag and drop from Windows Explorer / Desktop
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    tauriApi
      .onWindowDragDrop((payload) => {
        const { paths, position } = payload;
        if (!paths || paths.length === 0) return;

        const windowWidth = window.innerWidth;
        const isRemoteSide = sessionId ? position.x > windowWidth / 2 : false;

        if (isRemoteSide && sessionId) {
          handleDropTransfer(true, 'local', paths, remote.currentPath);
        } else {
          // If single path dropped on local pane and is directory, navigate
          if (paths.length === 1) {
            loadLocalDir(paths[0]);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.warn('Native drag-drop listener not registered:', err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [sessionId, remote.currentPath, handleDropTransfer, loadLocalDir]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#1e1e2d]">
      {/* Local Explorer */}
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
        onDropTransfer={(src, paths, target) => handleDropTransfer(false, src, paths, target)}
      />

      {/* Transfer Action Bar */}
      <div className="flex flex-col items-center justify-center gap-1.5 px-1.5 shrink-0 bg-[#11111a] border-x border-[#2a2b38]">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!sessionId || local.selectedPaths.length === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-slate-300 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-[#1e1e2d] transition-colors"
          title="Upload to Remote Host (Push)"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!sessionId || remote.selectedPaths.length === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-slate-300 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-[#1e1e2d] transition-colors"
          title="Download to Local Machine (Pull)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Remote Explorer */}
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
          onDropTransfer={(src, paths, target) => handleDropTransfer(true, src, paths, target)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center bg-[#1e1e2d] text-center p-8">
          <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#11111a] border border-[#2a2b38]">
            <CloudOff className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-xs font-medium text-slate-300">Remote Offline</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
            Connect to an active SSH profile to browse remote filesystem.
          </p>
        </div>
      )}
    </div>
  );
};
