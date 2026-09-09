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
import { ArrowRight, ArrowLeft, CloudOff, Bookmark, Plus, X, FolderTree } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { DirectoryTree } from './DirectoryTree';
import { TransferDrawer } from './TransferDrawer';

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
    goBack,
    goForward,
  } = useFileManagerStore();

  const { startDownload, startUpload } = useTransferStore();
  const session = useSessionStore((state) => state.activeSessions.find((s) => s.id === sessionId));
  const addSessionBookmark = useSessionStore((state) => state.addSessionBookmark);
  const removeSessionBookmark = useSessionStore((state) => state.removeSessionBookmark);
  const bookmarks = session?.bookmarks || [];
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);

  // FileZilla-style directory tree state
  const [localTreeHeightPercent, setLocalTreeHeightPercent] = useState<number>(() => {
    const saved = localStorage.getItem('openterm_local_tree_height');
    return saved ? Math.min(80, Math.max(15, parseInt(saved, 10))) : 35;
  });

  const [remoteTreeHeightPercent, setRemoteTreeHeightPercent] = useState<number>(() => {
    const saved = localStorage.getItem('openterm_remote_tree_height');
    return saved ? Math.min(80, Math.max(15, parseInt(saved, 10))) : 35;
  });

  const [showDirectoryTrees, setShowDirectoryTrees] = useState<boolean>(() => {
    const saved = localStorage.getItem('openterm_show_dir_trees');
    return saved !== null ? saved === 'true' : true;
  });

  const handleLocalTreeResize = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.clientHeight;
    if (totalHeight <= 0) return;
    setLocalTreeHeightPercent((prev) => {
      const deltaPercent = (deltaY / totalHeight) * 100;
      const next = Math.min(80, Math.max(15, prev + deltaPercent));
      localStorage.setItem('openterm_local_tree_height', Math.round(next).toString());
      return next;
    });
  }, []);

  const handleRemoteTreeResize = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.clientHeight;
    if (totalHeight <= 0) return;
    setRemoteTreeHeightPercent((prev) => {
      const deltaPercent = (deltaY / totalHeight) * 100;
      const next = Math.min(80, Math.max(15, prev + deltaPercent));
      localStorage.setItem('openterm_remote_tree_height', Math.round(next).toString());
      return next;
    });
  }, []);

  const toggleDirectoryTrees = () => {
    setShowDirectoryTrees((prev) => {
      const next = !prev;
      localStorage.setItem('openterm_show_dir_trees', String(next));
      return next;
    });
  };

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
  const handleBookmarkCurrentLocations = () => {
    if (!sessionId) return;
    const defaultName = `${getBasename(local.currentPath) || 'Local'} ↔ ${getBasename(remote.currentPath) || 'Remote'}`;
    setPromptState({
      isOpen: true,
      title: 'Bookmark Current Locations',
      message: 'Enter a display label for this bookmark pair:',
      initialValue: defaultName,
      confirmLabel: 'Save Bookmark',
      onConfirm: (label) => {
        const trimmed = label.trim() || defaultName;
        addSessionBookmark(sessionId, {
          id: crypto.randomUUID(),
          name: trimmed,
          localPath: local.currentPath,
          remotePath: remote.currentPath,
        });
        setShowBookmarkMenu(false);
      },
    });
  };

  const handleBookmarkFolder = (entry: FileEntry, isRemote: boolean) => {
    if (!sessionId) return;
    setPromptState({
      isOpen: true,
      title: `Bookmark ${isRemote ? 'Remote' : 'Local'} Folder`,
      message: 'Enter a display label for this bookmark:',
      initialValue: entry.name,
      confirmLabel: 'Save Bookmark',
      onConfirm: (label) => {
        const trimmed = label.trim() || entry.name;
        addSessionBookmark(sessionId, {
          id: crypto.randomUUID(),
          name: trimmed,
          localPath: isRemote ? undefined : entry.path,
          remotePath: isRemote ? entry.path : undefined,
        });
      },
    });
  };
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

  const prevSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!local.currentPath) {
      loadLocalDir('~');
    }
  }, [local.currentPath, loadLocalDir]);

  useEffect(() => {
    if (!sessionId) {
      prevSessionIdRef.current = null;
      return;
    }
    if (prevSessionIdRef.current !== sessionId || !remote.currentPath) {
      prevSessionIdRef.current = sessionId;
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

      const currentRemote = useFileManagerStore.getState().remote.currentPath;
      const currentLocal = useFileManagerStore.getState().local.currentPath;

      const destDir = isUpload
        ? (targetFolder || currentRemote)
        : (targetFolder || currentLocal);

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
        loadRemoteDir(sessionId, currentRemote);
      } else {
        loadLocalDir(currentLocal);
      }
    },
    [sessionId, promptConflict, startUpload, startDownload, loadRemoteDir, loadLocalDir]
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

        const dpr = window.devicePixelRatio || 1;
        const targetEl =
          document.elementFromPoint(position.x / dpr, position.y / dpr) ||
          document.elementFromPoint(position.x, position.y);

        const folderRow = targetEl?.closest('[data-file-row][data-is-dir="true"]');
        const paneEl = targetEl?.closest('[data-file-pane]');

        if (folderRow) {
          const targetFolder = folderRow.getAttribute('data-entry-path');
          const isRemoteFolder = folderRow.getAttribute('data-is-remote') === 'true';
          if (targetFolder) {
            if (isRemoteFolder && sessionId) {
              handleDropTransfer(true, 'local', paths, targetFolder);
            } else if (!isRemoteFolder) {
              if (paths.length === 1 && paths[0]) {
                loadLocalDir(targetFolder);
              }
            }
            return;
          }
        }

        const isRemotePane = paneEl
          ? paneEl.getAttribute('data-pane-is-remote') === 'true'
          : (sessionId ? (position.x / dpr) > window.innerWidth / 2 : false);

        const currentRemote = useFileManagerStore.getState().remote.currentPath;

        if (isRemotePane && sessionId) {
          const targetDir = paneEl?.getAttribute('data-pane-current-path') || currentRemote;
          handleDropTransfer(true, 'local', paths, targetDir);
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
  }, [sessionId, handleDropTransfer, loadLocalDir]);

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
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#1e1e2d] relative">
      <div ref={containerRef} className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        {/* Local Explorer Column */}
        <div style={{ width: `${localSplitPercent}%` }} className="h-full min-w-[180px] overflow-hidden flex flex-col">
          {showDirectoryTrees && (
            <>
              <div style={{ height: `${localTreeHeightPercent}%` }} className="min-h-[90px] overflow-hidden shrink-0">
                <DirectoryTree
                  currentPath={local.currentPath}
                  isRemote={false}
                  onSelectFolder={(p) => loadLocalDir(p)}
                />
              </div>
              <ResizableSplitter direction="vertical" onResize={handleLocalTreeResize} />
            </>
          )}
          <div className="flex-1 min-h-[120px] overflow-hidden flex flex-col">
            <FilePane
              title="Local Machine"
              isRemote={false}
              currentPath={local.currentPath}
              entries={local.entries}
              total={local.total}
              isLoading={local.isLoading}
              error={local.error}
              selectedPaths={local.selectedPaths}
              canGoBack={local.historyIndex > 0}
              canGoForward={local.historyIndex < local.history.length - 1}
              onGoBack={() => goBack(false)}
              onGoForward={() => goForward(false)}
              onSelect={setLocalSelected}
              onNavigate={(p) => loadLocalDir(p)}
              onRefresh={() => loadLocalDir(local.currentPath)}
              onDropTransfer={(src, paths, target) => handleDropTransfer(false, src, paths, target)}
              onTransferItem={(entry) => handleTransferSingle(entry, false)}
              onRenameItem={(entry) => handleRename(entry, false)}
              onDeleteItem={(entry) => handleDelete(entry, false)}
              onBookmarkFolder={(entry) => handleBookmarkFolder(entry, false)}
              onNewFile={() => handleNewFile(false)}
              onNewFolder={() => handleNewFolder(false)}
            />
          </div>
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

            <button
              type="button"
              onClick={toggleDirectoryTrees}
              className={`flex h-7 w-7 items-center justify-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] transition-colors cursor-pointer ${
                showDirectoryTrees
                  ? 'text-indigo-400 border-indigo-500/50 bg-indigo-950/20'
                  : 'text-slate-400 hover:text-white hover:bg-[#252538]'
              }`}
              title={showDirectoryTrees ? 'Hide Directory Trees' : 'Show Directory Trees'}
            >
              <FolderTree className="h-3.5 w-3.5" />
            </button>

            <div className="relative mt-2 pt-2 border-t border-[#2a2b38]">
              <button
                type="button"
                onClick={() => setShowBookmarkMenu(!showBookmarkMenu)}
                className={`flex h-7 w-7 items-center justify-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] transition-colors cursor-pointer ${
                  showBookmarkMenu
                    ? 'text-amber-300 border-amber-500/50 bg-amber-950/20'
                    : 'text-amber-400 hover:text-white hover:bg-amber-600 hover:border-amber-600'
                }`}
                title="SFTP Bookmarks"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
              {showBookmarkMenu && (
                <div className="absolute left-9 top-0 z-50 w-60 rounded-md bg-[#181824] border border-[#2a2b38] shadow-2xl py-1 text-xs">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#2a2b38]">
                    <span>SFTP Bookmarks</span>
                    <button
                      type="button"
                      onClick={() => setShowBookmarkMenu(false)}
                      className="text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Bookmark current locations action */}
                  <button
                    type="button"
                    disabled={!sessionId}
                    onClick={handleBookmarkCurrentLocations}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/30 text-indigo-300 border-b border-[#2a2b38]/60 cursor-pointer text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-medium text-[11px]">Bookmark Current Locations</span>
                  </button>

                  <div className="max-h-56 overflow-y-auto">
                    {bookmarks.length === 0 ? (
                      <div className="px-3 py-3 text-center text-[11px] text-slate-500 italic">
                        No bookmarks saved for this host yet
                      </div>
                    ) : (
                      bookmarks.map((bm) => (
                        <div
                          key={bm.id}
                          className="flex items-center justify-between group px-2 py-1.5 hover:bg-[#252538] text-slate-200 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (bm.localPath) loadLocalDir(bm.localPath);
                              if (sessionId && bm.remotePath) loadRemoteDir(sessionId, bm.remotePath);
                              setShowBookmarkMenu(false);
                            }}
                            className="flex-1 text-left min-w-0 pr-1 cursor-pointer"
                            title={`${bm.name}\nLocal: ${bm.localPath || 'N/A'}\nRemote: ${bm.remotePath || 'N/A'}`}
                          >
                            <div className="font-medium text-xs text-white truncate">{bm.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {bm.remotePath && bm.localPath
                                ? `${bm.localPath} ↔ ${bm.remotePath}`
                                : bm.remotePath
                                ? `Remote: ${bm.remotePath}`
                                : `Local: ${bm.localPath}`}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (sessionId) removeSessionBookmark(sessionId, bm.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-all cursor-pointer shrink-0"
                            title="Delete bookmark"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <ResizableSplitter onResize={handleDualPaneResize} />
        </div>

        {/* Remote Explorer Column */}
        <div style={{ width: `${100 - localSplitPercent}%` }} className="h-full min-w-[180px] overflow-hidden flex flex-col flex-1">
          {sessionId ? (
            <>
              {showDirectoryTrees && (
                <>
                  <div style={{ height: `${remoteTreeHeightPercent}%` }} className="min-h-[90px] overflow-hidden shrink-0">
                    <DirectoryTree
                      currentPath={remote.currentPath}
                      isRemote={true}
                      sessionId={sessionId}
                      onSelectFolder={(p) => loadRemoteDir(sessionId, p)}
                    />
                  </div>
                  <ResizableSplitter direction="vertical" onResize={handleRemoteTreeResize} />
                </>
              )}
              <div className="flex-1 min-h-[120px] overflow-hidden flex flex-col">
                <FilePane
                  title="Remote SFTP"
                  isRemote={true}
                  currentPath={remote.currentPath}
                  entries={remote.entries}
                  total={remote.total}
                  isLoading={remote.isLoading}
                  error={remote.error}
                  selectedPaths={remote.selectedPaths}
                  canGoBack={remote.historyIndex > 0}
                  canGoForward={remote.historyIndex < remote.history.length - 1}
                  onGoBack={() => sessionId && goBack(true, sessionId)}
                  onGoForward={() => sessionId && goForward(true, sessionId)}
                  onSelect={setRemoteSelected}
                  onNavigate={(p) => loadRemoteDir(sessionId, p)}
                  onRefresh={() => loadRemoteDir(sessionId, remote.currentPath)}
                  onDropTransfer={(src, paths, target) => handleDropTransfer(true, src, paths, target)}
                  onEditFile={(entry) => setEditorState({ isOpen: true, filePath: entry.path, isRemote: true })}
                  onTransferItem={(entry) => handleTransferSingle(entry, true)}
                  onRenameItem={(entry) => handleRename(entry, true)}
                  onChmodItem={(entry) => setChmodState({ isOpen: true, entry })}
                  onDeleteItem={(entry) => handleDelete(entry, true)}
                  onBookmarkFolder={(entry) => handleBookmarkFolder(entry, true)}
                  onNewFile={() => handleNewFile(true)}
                  onNewFolder={() => handleNewFolder(true)}
                />
              </div>
            </>
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
      </div>

      {/* Docked SFTP Transfer Drawer */}
      <TransferDrawer />

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
