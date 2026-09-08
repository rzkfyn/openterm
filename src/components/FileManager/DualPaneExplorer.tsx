import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useFileManagerStore } from '../../stores/fileManagerStore';
import { useTransferStore } from '../../stores/transferStore';
import { tauriApi } from '../../services/tauri';
import { getBasename, joinLocalPath, joinRemotePath } from '../../utils/pathUtils';
import { FilePane } from './FilePane';
import { ResizableSplitter } from '../Common/ResizableSplitter';
import { PromptModal } from '../Modal/PromptModal';
import { ChmodModal } from './ChmodModal';
import { FileEditorModal } from './FileEditorModal';
import { FileEntry } from '../../types';
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

  // Prompt Modal state
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    initialValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    isDanger?: boolean;
    isConfirmOnly?: boolean;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Chmod Modal state
  const [chmodState, setChmodState] = useState<{
    isOpen: boolean;
    entry: FileEntry | null;
  }>({
    isOpen: false,
    entry: null,
  });

  // File Editor Modal state
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    filePath: string;
    isRemote: boolean;
  }>({
    isOpen: false,
    filePath: '',
    isRemote: true,
  });

  // Dual pane split percentage
  const [localSplitPercent, setLocalSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('openterm_sftp_split_percent');
    return saved ? Math.max(20, Math.min(80, parseFloat(saved))) : 50;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDualPaneResize = (deltaX: number) => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.clientWidth;
    if (totalWidth <= 0) return;
    const deltaPercent = (deltaX / totalWidth) * 100;
    setLocalSplitPercent((prev) => {
      const next = Math.max(20, Math.min(80, prev + deltaPercent));
      localStorage.setItem('openterm_sftp_split_percent', next.toFixed(1));
      return next;
    });
  };

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

  // Context Menu CRUD Operations
  const handleRename = (entry: FileEntry, isRemote: boolean) => {
    setPromptState({
      isOpen: true,
      title: `Rename ${entry.isDir ? 'Folder' : 'File'}`,
      initialValue: entry.name,
      confirmLabel: 'Rename',
      onConfirm: async (newName: string) => {
        if (!newName || newName === entry.name) {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        try {
          if (isRemote) {
            if (!sessionId) return;
            const newPath = joinRemotePath(remote.currentPath, newName);
            await tauriApi.sftpRename(sessionId, entry.path, newPath);
            loadRemoteDir(sessionId, remote.currentPath);
          } else {
            const newPath = joinLocalPath(local.currentPath, newName);
            await tauriApi.localRename(entry.path, newPath);
            loadLocalDir(local.currentPath);
          }
        } catch (err: any) {
          alert(`Failed to rename: ${err?.message || err}`);
        } finally {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = (entry: FileEntry, isRemote: boolean) => {
    setPromptState({
      isOpen: true,
      title: `Delete ${entry.isDir ? 'Folder' : 'File'}`,
      message: `Are you sure you want to permanently delete "${entry.name}"?${
        entry.isDir ? ' All files inside will also be deleted.' : ''
      }`,
      confirmLabel: 'Delete',
      isDanger: true,
      isConfirmOnly: true,
      onConfirm: async () => {
        try {
          if (isRemote) {
            if (!sessionId) return;
            await tauriApi.sftpRemove(sessionId, entry.path, entry.isDir);
            loadRemoteDir(sessionId, remote.currentPath);
          } else {
            await tauriApi.localRemove(entry.path, entry.isDir);
            loadLocalDir(local.currentPath);
          }
        } catch (err: any) {
          alert(`Failed to delete: ${err?.message || err}`);
        } finally {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleNewFile = (isRemote: boolean) => {
    setPromptState({
      isOpen: true,
      title: 'Create New File',
      placeholder: 'filename.txt',
      confirmLabel: 'Create',
      onConfirm: async (fileName: string) => {
        if (!fileName) {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        try {
          if (isRemote) {
            if (!sessionId) return;
            const filePath = joinRemotePath(remote.currentPath, fileName);
            await tauriApi.sftpTouch(sessionId, filePath);
            loadRemoteDir(sessionId, remote.currentPath);
          } else {
            const filePath = joinLocalPath(local.currentPath, fileName);
            await tauriApi.localTouch(filePath);
            loadLocalDir(local.currentPath);
          }
        } catch (err: any) {
          alert(`Failed to create file: ${err?.message || err}`);
        } finally {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleNewFolder = (isRemote: boolean) => {
    setPromptState({
      isOpen: true,
      title: 'Create New Folder',
      placeholder: 'new-folder',
      confirmLabel: 'Create',
      onConfirm: async (folderName: string) => {
        if (!folderName) {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        try {
          if (isRemote) {
            if (!sessionId) return;
            const folderPath = joinRemotePath(remote.currentPath, folderName);
            await tauriApi.sftpMkdir(sessionId, folderPath);
            loadRemoteDir(sessionId, remote.currentPath);
          } else {
            const folderPath = joinLocalPath(local.currentPath, folderName);
            await tauriApi.localMkdir(folderPath);
            loadLocalDir(local.currentPath);
          }
        } catch (err: any) {
          alert(`Failed to create folder: ${err?.message || err}`);
        } finally {
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleChmodConfirm = async (mode: number) => {
    if (!sessionId || !chmodState.entry) return;
    try {
      await tauriApi.sftpChmod(sessionId, chmodState.entry.path, mode);
      loadRemoteDir(sessionId, remote.currentPath);
    } catch (err: any) {
      alert(`Failed to change permissions: ${err?.message || err}`);
    } finally {
      setChmodState({ isOpen: false, entry: null });
    }
  };

  const handleTransferSingle = async (entry: FileEntry, isRemoteSource: boolean) => {
    if (!sessionId) return;
    if (isRemoteSource) {
      const destLocal = joinLocalPath(local.currentPath, entry.name);
      await startDownload(sessionId, entry.path, destLocal);
      loadLocalDir(local.currentPath);
    } else {
      const destRemote = joinRemotePath(remote.currentPath, entry.name);
      await startUpload(sessionId, entry.path, destRemote);
      loadRemoteDir(sessionId, remote.currentPath);
    }
  };

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#1e1e2d] relative">
      {/* Local Explorer */}
      <div style={{ width: `${localSplitPercent}%` }} className="h-full min-w-[180px] overflow-hidden flex flex-col">
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
          onTransferItem={(entry) => handleTransferSingle(entry, false)}
          onRenameItem={(entry) => handleRename(entry, false)}
          onDeleteItem={(entry) => handleDelete(entry, false)}
          onNewFile={() => handleNewFile(false)}
          onNewFolder={() => handleNewFolder(false)}
        />
      </div>

      {/* Resizable Separator with Action Buttons */}
      <div className="flex items-center shrink-0">
        <div className="flex flex-col items-center justify-center gap-1.5 px-1.5 shrink-0 bg-[#11111a] border-x border-[#2a2b38] h-full">
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
        <ResizableSplitter onResize={handleDualPaneResize} />
      </div>

      {/* Remote Explorer */}
      <div style={{ width: `${100 - localSplitPercent}%` }} className="h-full min-w-[180px] overflow-hidden flex flex-col flex-1">
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
            onEditFile={(entry) => setEditorState({ isOpen: true, filePath: entry.path, isRemote: true })}
            onTransferItem={(entry) => handleTransferSingle(entry, true)}
            onRenameItem={(entry) => handleRename(entry, true)}
            onChmodItem={(entry) => setChmodState({ isOpen: true, entry })}
            onDeleteItem={(entry) => handleDelete(entry, true)}
            onNewFile={() => handleNewFile(true)}
            onNewFolder={() => handleNewFolder(true)}
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

      {/* Modals */}
      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        message={promptState.message}
        initialValue={promptState.initialValue}
        placeholder={promptState.placeholder}
        confirmLabel={promptState.confirmLabel}
        isDanger={promptState.isDanger}
        isConfirmOnly={promptState.isConfirmOnly}
        onConfirm={promptState.onConfirm}
        onClose={() => setPromptState((prev) => ({ ...prev, isOpen: false }))}
      />

      <ChmodModal
        isOpen={chmodState.isOpen}
        fileName={chmodState.entry?.name || ''}
        currentMode={chmodState.entry?.permissions}
        onConfirm={handleChmodConfirm}
        onClose={() => setChmodState({ isOpen: false, entry: null })}
      />

      <FileEditorModal
        isOpen={editorState.isOpen}
        filePath={editorState.filePath}
        isRemote={editorState.isRemote}
        sessionId={sessionId || undefined}
        onClose={() => setEditorState({ isOpen: false, filePath: '', isRemote: true })}
        onSaved={() => {
          if (sessionId && editorState.isRemote) {
            loadRemoteDir(sessionId, remote.currentPath);
          } else {
            loadLocalDir(local.currentPath);
          }
        }}
      />
    </div>
  );
};
