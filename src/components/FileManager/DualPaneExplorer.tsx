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
import { TransferConflictModal, ConflictDetails } from './TransferConflictModal';
import { ConflictAction, FileEntry } from '../../types';
import { shouldTransferOnConflict, resolveDestinationPath } from '../../utils/conflictUtils';
import { ArrowRight, ArrowLeft, CloudOff, Bookmark } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';

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
  const session = useSessionStore((state) => state.sessions.find((s) => s.id === sessionId));
  const bookmarks = session?.config?.bookmarks || [];
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);

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

  // Transfer Conflict Modal state
  const [conflictState, setConflictState] = useState<{
    isOpen: boolean;
    conflict: ConflictDetails | null;
    resolver: ((decision: { action: ConflictAction; applyToAll: boolean } | null) => void) | null;
  }>({
    isOpen: false,
    conflict: null,
    resolver: null,
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

  const promptConflict = useCallback(
    (conflict: ConflictDetails): Promise<{ action: ConflictAction; applyToAll: boolean } | null> => {
      return new Promise((resolve) => {
        setConflictState({
          isOpen: true,
          conflict,
          resolver: resolve,
        });
      });
    },
    []
  );

  const executeTransferWithConflict = useCallback(
    async (
      isUpload: boolean,
      sourcePaths: string[],
      targetFolder?: string
    ) => {
      if (!sessionId || sourcePaths.length === 0) return;

      const destDir = isUpload
        ? targetFolder || remote.currentPath
        : targetFolder || local.currentPath;

      let sessionConflictAction: ConflictAction | null = null;

      for (const srcPath of sourcePaths) {
        const fileName = getBasename(srcPath) || 'file';
        let candidateDest = isUpload
          ? joinRemotePath(destDir, fileName)
          : joinLocalPath(destDir, fileName);

        // Check if destination exists
        const destStat = isUpload
          ? await tauriApi.sftpStat(sessionId, candidateDest)
          : await tauriApi.localStat(candidateDest);

        let finalDest = candidateDest;

        if (destStat.exists) {
          const srcStat = isUpload
            ? await tauriApi.localStat(srcPath)
            : await tauriApi.sftpStat(sessionId, srcPath);

          let actionToUse = sessionConflictAction;

          if (!actionToUse) {
            const decision = await promptConflict({
              fileName,
              sourcePath: srcPath,
              destPath: candidateDest,
              isUpload,
              sourceStat: { size: srcStat.size, modified: srcStat.modified },
              destStat,
            });

            if (!decision) {
              // User canceled transfer queue
              break;
            }

            actionToUse = decision.action;
            if (decision.applyToAll) {
              sessionConflictAction = decision.action;
            }
          }

          if (actionToUse === 'skip') {
            continue;
          }

          if (actionToUse === 'overwrite_newer' || actionToUse === 'overwrite_size') {
            const allow = shouldTransferOnConflict(actionToUse, srcStat, destStat);
            if (!allow) {
              continue;
            }
          } else if (actionToUse === 'rename') {
            const resolved = await resolveDestinationPath(
              candidateDest,
              'rename',
              async (p) => {
                const stat = isUpload
                  ? await tauriApi.sftpStat(sessionId, p)
                  : await tauriApi.localStat(p);
                return stat.exists;
              }
            );
            if (!resolved) continue;
            finalDest = resolved;
          }
        }

        // Start transfer
        if (isUpload) {
          await startUpload(sessionId, srcPath, finalDest);
        } else {
          await startDownload(sessionId, srcPath, finalDest);
        }
      }

      if (isUpload) {
        loadRemoteDir(sessionId, remote.currentPath);
      } else {
        loadLocalDir(local.currentPath);
      }
    },
    [sessionId, remote.currentPath, local.currentPath, promptConflict, startUpload, startDownload, loadRemoteDir, loadLocalDir]
  );

  const handleDownload = async () => {
    if (!sessionId) return;
    const paths = [...remote.selectedPaths];
    await executeTransferWithConflict(false, paths);
  };

  const handleUpload = async () => {
    if (!sessionId) return;
    const paths = [...local.selectedPaths];
    await executeTransferWithConflict(true, paths);
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
        await executeTransferWithConflict(true, paths, targetFolder);
      } else if (!targetIsRemote && source === 'remote') {
        await executeTransferWithConflict(false, paths, targetFolder);
      }
    },
    [sessionId, executeTransferWithConflict]
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
    await executeTransferWithConflict(!isRemoteSource, [entry.path]);
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

          {bookmarks.length > 0 && (
            <div className="relative mt-2 pt-2 border-t border-[#2a2b38]">
              <button
                type="button"
                onClick={() => setShowBookmarkMenu(!showBookmarkMenu)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-amber-400 hover:text-white hover:bg-amber-600 hover:border-amber-600 cursor-pointer transition-colors"
                title="Jump to SFTP Bookmark"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
              {showBookmarkMenu && (
                <div className="absolute left-9 top-0 z-50 w-52 rounded-md bg-[#181824] border border-[#2a2b38] shadow-xl py-1 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#2a2b38]">
                    SFTP Bookmarks
                  </div>
                  {bookmarks.map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      onClick={() => {
                        if (bm.localPath) loadLocalDir(bm.localPath);
                        if (sessionId && bm.remotePath) loadRemoteDir(sessionId, bm.remotePath);
                        setShowBookmarkMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-[#252538] text-slate-200 cursor-pointer block truncate"
                      title={`${bm.name}\nLocal: ${bm.localPath || 'N/A'}\nRemote: ${bm.remotePath || 'N/A'}`}
                    >
                      <div className="font-medium text-xs text-white truncate">{bm.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {bm.remotePath ? `Remote: ${bm.remotePath}` : `Local: ${bm.localPath}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

      <TransferConflictModal
        isOpen={conflictState.isOpen}
        conflict={conflictState.conflict}
        onResolve={(action, applyToAll) => {
          if (conflictState.resolver) {
            conflictState.resolver({ action, applyToAll });
          }
          setConflictState({ isOpen: false, conflict: null, resolver: null });
        }}
        onCancel={() => {
          if (conflictState.resolver) {
            conflictState.resolver(null);
          }
          setConflictState({ isOpen: false, conflict: null, resolver: null });
        }}
      />
    </div>
  );
};
