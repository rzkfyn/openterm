import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry } from '../../types';
import { FileItemRow } from './FileItemRow';
import { PathBreadcrumb } from './PathBreadcrumb';
import { ContextMenu, ContextMenuPosition } from './ContextMenu';
import { Loader2, ChevronUp, ChevronDown, ArrowDownToLine, Search, X, Check, RotateCcw } from 'lucide-react';
import { useColumnConfigStore } from '../../stores/columnConfigStore';

type SortKey = 'name' | 'size' | 'modified';
type SortDir = 'asc' | 'desc';

interface FilePaneProps {
  title: string;
  isRemote?: boolean;
  currentPath: string;
  entries: FileEntry[];
  total: number;
  isLoading: boolean;
  error: string | null;
  selectedPaths: string[];
  canGoBack?: boolean;
  canGoForward?: boolean;
  fileDoubleClickAction?: 'transfer' | 'edit';
  onGoBack?: () => void;
  onGoForward?: () => void;
  onSelect: (paths: string[]) => void;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onDropTransfer?: (source: 'local' | 'remote', paths: string[], targetFolder?: string) => void;
  onEditFile?: (entry: FileEntry) => void;
  onOpenExternal?: (entry: FileEntry) => void;
  onCopyFiles?: (entry: FileEntry) => void;
  onTransferItem?: (entry: FileEntry) => void;
  onRenameItem?: (entry: FileEntry) => void;
  onChmodItem?: (entry: FileEntry) => void;
  onDeleteItem?: (entry: FileEntry) => void;
  onBookmarkFolder?: (entry: FileEntry) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onStartNativeDrag?: (paths: string[], isRemote: boolean) => void;
  nativeDragOver?: boolean;
}

export const FilePane: React.FC<FilePaneProps> = ({
  title,
  isRemote = false,
  currentPath,
  entries,
  total,
  onOpenExternal,
  onCopyFiles,
  fileDoubleClickAction = 'transfer',
  isLoading,
  error,
  selectedPaths,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onSelect,
  onNavigate,
  onRefresh,
  onDropTransfer,
  onEditFile,
  onTransferItem,
  onRenameItem,
  onChmodItem,
  onDeleteItem,
  onBookmarkFolder,
  onNewFile,
  onNewFolder,
  onStartNativeDrag,
  nativeDragOver = false,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [isPaneDragOver, setIsPaneDragOver] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    targetEntry?: FileEntry | null;
  } | null>(null);
  const {
    sizeWidth,
    modifiedWidth,
    showSize,
    showModified,
    setSizeWidth,
    setModifiedWidth,
    toggleShowSize,
    toggleShowModified,
    resetColumns,
  } = useColumnConfigStore();
  const [headerMenuPos, setHeaderMenuPos] = useState<{ x: number; y: number } | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHeaderClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuPos(null);
      }
    };
    if (headerMenuPos) {
      window.addEventListener('mousedown', handleHeaderClickOutside);
      return () => window.removeEventListener('mousedown', handleHeaderClickOutside);
    }
  }, [headerMenuPos]);

  const handleResizeColumnStart = (col: 'size' | 'modified', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initialWidth = col === 'size' ? sizeWidth : modifiedWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (col === 'size') {
        setSizeWidth(initialWidth - delta);
      } else {
        setModifiedWidth(initialWidth - delta);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    setSearchFilter('');
    setIsSearchVisible(false);
  }, [currentPath]);

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return entries;
    const tokens = searchFilter.toLowerCase().trim().split(/\s+/);
    return entries.filter((e) => {
      const name = e.name.toLowerCase();
      return tokens.every((t) => name.includes(t));
    });
  }, [entries, searchFilter]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'modified':
          cmp = (a.modified ?? 0) - (b.modified ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredEntries, sortKey, sortDir]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 16,
  });

  const handleParent = () => {
    if (!currentPath || currentPath === '/' || currentPath === '\\') return;
    const norm = currentPath.replace(/\\/g, '/');
    if (/^[A-Za-z]:\/?$/.test(norm)) return;
    const parentPath = norm.substring(0, norm.lastIndexOf('/')) || '/';
    onNavigate(parentPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Intercept Ctrl+F / Cmd+F anywhere inside pane (including inside input) to suppress browser/OS search
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      setIsSearchVisible(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
      return;
    }

    // If typing inside an input (like search filter or breadcrumb), allow normal typing unless Esc
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const isInput = targetTag === 'input' || targetTag === 'textarea';

    if (e.key === 'Escape') {
      if (isSearchVisible) {
        setIsSearchVisible(false);
        setSearchFilter('');
        paneContainerRef.current?.focus();
        return;
      }
    }

    if (isInput) return;

    // Refresh (F5 or Ctrl+R)
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      onRefresh();
      return;
    }

    // New File / Folder (Ctrl+N / Ctrl+Shift+N)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      if (e.shiftKey) {
        onNewFolder?.();
      } else {
        onNewFile?.();
      }
      return;
    }

    // Get current single selected entry
    const selectedEntry = sortedEntries.find((item) => selectedPaths.includes(item.path));

    // Rename (F2)
    if (e.key === 'F2') {
      e.preventDefault();
      if (selectedEntry) onRenameItem?.(selectedEntry);
      return;
    }

    // Delete (Delete)
    if (e.key === 'Delete') {
      e.preventDefault();
      if (selectedEntry) onDeleteItem?.(selectedEntry);
      return;
    }

    // Arrow Navigation
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (canGoBack) onGoBack?.();
      return;
    }

    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (canGoForward) onGoForward?.();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (sortedEntries.length === 0) return;
      const currentIndex = sortedEntries.findIndex((item) => selectedPaths.includes(item.path));
      const nextIndex = Math.min(sortedEntries.length - 1, currentIndex + 1);
      onSelect([sortedEntries[nextIndex].path]);
      rowVirtualizer.scrollToIndex(nextIndex);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (sortedEntries.length === 0) return;
      const currentIndex = sortedEntries.findIndex((item) => selectedPaths.includes(item.path));
      const prevIndex = Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1);
      onSelect([sortedEntries[prevIndex].path]);
      rowVirtualizer.scrollToIndex(prevIndex);
      return;
    }
    // Ctrl+C to Copy File Paths
    // Ctrl+C to Copy Files
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (selectedEntry && onCopyFiles) {
        onCopyFiles(selectedEntry);
      } else if (selectedPaths.length > 0) {
        navigator.clipboard.writeText(selectedPaths.join('\n'));
      }
      return;
    }
    // Enter to Open / Edit
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedEntry) {
        if (selectedEntry.isDir) {
          onNavigate(selectedEntry.path);
        } else if (onEditFile) {
          onEditFile(selectedEntry);
        }
      }
      return;
    }

    // Backspace to Parent Directory
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleParent();
      return;
    }
  };

  const handleRowSelect = (entry: FileEntry, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (selectedPaths.includes(entry.path)) {
        onSelect(selectedPaths.filter((p) => p !== entry.path));
      } else {
        onSelect([...selectedPaths, entry.path]);
      }
    } else {
      onSelect([entry.path]);
    }
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDir) {
      onNavigate(entry.path);
    } else if (fileDoubleClickAction === 'edit') {
      if (onEditFile) onEditFile(entry);
    } else if (onTransferItem) {
      onTransferItem(entry);
    } else if (onEditFile) {
      onEditFile(entry);
    }
  };

  const handleRowContextMenu = (entry: FileEntry, e: React.MouseEvent) => {
    if (!selectedPaths.includes(entry.path)) {
      onSelect([entry.path]);
    }
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      targetEntry: entry,
    });
  };

  const handlePaneContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      targetEntry: null,
    });
  };

  const handlePaneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isPaneDragOver) setIsPaneDragOver(true);
  };

  const handlePaneDragLeave = (e: React.DragEvent) => {
    // Only deactivate if leaving the container boundaries
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsPaneDragOver(false);
  };

  const handlePaneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPaneDragOver(false);

    if (!onDropTransfer) return;

    // 1. Internal transfer payload
    try {
      const raw = e.dataTransfer.getData('application/x-openterm-transfer');
      if (raw) {
        const { source, paths } = JSON.parse(raw);
        onDropTransfer(source, paths, currentPath);
        return;
      }
    } catch (err) {
      console.error('Failed to parse drag-and-drop payload:', err);
    }
      // External OS drops (Finder/Explorer) are handled by Tauri's native
      // onDragDropEvent in DualPaneExplorer — HTML5 dataTransfer.files
      // does not carry file paths in Tauri's webview.
  };

  const handlePaneMouseDown = (e: React.MouseEvent) => {
    if (e.button === 3) {
      // Mouse 4: Back
      e.preventDefault();
      if (canGoBack) onGoBack?.();
    } else if (e.button === 4) {
      // Mouse 5: Forward
      e.preventDefault();
      if (canGoForward) onGoForward?.();
    }
  };

  return (
    <div
      ref={paneContainerRef}
      tabIndex={0}
      data-file-pane="true"
      data-pane-is-remote={isRemote ? 'true' : 'false'}
      data-pane-current-path={currentPath}
      onKeyDown={handleKeyDown}
      onMouseDown={handlePaneMouseDown}
      className={`relative flex flex-1 flex-col h-full bg-[#1e1e2d] overflow-hidden select-none outline-none transition-colors ${
        isPaneDragOver || nativeDragOver ? 'ring-2 ring-indigo-500/80 bg-[#252538]' : ''
      }`}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={handlePaneDrop}
    >
      {/* Visual Dropzone Overlay Banner when dragging */}
      {(isPaneDragOver || nativeDragOver) && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center bg-indigo-950/40 backdrop-blur-xs border-2 border-dashed border-indigo-400">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#11111a] border border-indigo-500 text-indigo-300 text-xs font-medium shadow-lg">
            <ArrowDownToLine className="h-4 w-4 animate-bounce" />
            <span>Drop to {isRemote ? 'Upload to Remote' : 'Download to Local'}</span>
          </div>
        </div>
      )}

      {/* Pane Section Header */}
      <div className="flex h-[28px] items-center justify-between bg-[#11111a] px-3 border-b border-[#2a2b38] text-[11px] font-medium text-slate-300">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${isRemote ? 'bg-sky-400' : 'bg-indigo-400'}`} />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsSearchVisible((prev) => {
                const next = !prev;
                if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
                else setSearchFilter('');
                return next;
              });
            }}
            className={`p-1 rounded transition-colors ${
              isSearchVisible || searchFilter
                ? 'bg-indigo-600/30 text-indigo-300'
                : 'text-slate-400 hover:text-white hover:bg-[#252636]'
            }`}
            title="Search & Filter Files (Ctrl+F)"
          >
            <Search className="h-3 w-3" />
          </button>
          <span className="text-[10px] font-mono text-slate-500">
            {searchFilter ? `${filteredEntries.length}/` : ''}
            {entries.length}/{total}
          </span>
        </div>
      </div>

      {/* Quick Search & Filter Bar */}
      {isSearchVisible && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141420] border-b border-[#2a2b38] text-xs">
          <Search className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                searchInputRef.current?.select();
                return;
              }
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                if (sortedEntries.length > 0) {
                  onSelect([sortedEntries[0].path]);
                  if (e.key === 'Enter') {
                    if (sortedEntries[0].isDir) {
                      onNavigate(sortedEntries[0].path);
                    } else if (onEditFile) {
                      onEditFile(sortedEntries[0]);
                    }
                  } else {
                    paneContainerRef.current?.focus();
                  }
                }
              }
            }}
            placeholder="Filter files by name... (Esc to dismiss)"
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none font-mono"
          />
          {searchFilter && (
            <span className="text-[10px] font-mono text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/40 shrink-0">
              {filteredEntries.length} found
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsSearchVisible(false);
              setSearchFilter('');
              paneContainerRef.current?.focus();
            }}
            className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-[#252636] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <PathBreadcrumb
        path={currentPath}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        isRemote={isRemote}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
      />

      {/* Column Headers */}
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHeaderMenuPos({ x: e.clientX, y: e.clientY });
        }}
        className="relative flex h-[22px] items-center px-3 bg-[#171724] border-b border-[#2a2b38] text-[10px] font-mono text-slate-400 select-none"
      >
        <button
          type="button"
          onClick={() => toggleSort('name')}
          className="flex flex-1 items-center gap-1 hover:text-slate-200 cursor-pointer transition-colors truncate"
        >
          <span>Name</span>
          {sortKey === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
        </button>

        {showSize && (
          <div className="flex items-center h-full shrink-0">
            <div
              onMouseDown={(e) => handleResizeColumnStart('size', e)}
              className="relative w-2 h-full cursor-col-resize flex items-center justify-center group/col shrink-0"
              title="Drag to resize column"
            >
              <div className="w-[1px] h-3.5 bg-[#2e3044] group-hover/col:bg-indigo-400 group-hover/col:w-[2px] transition-all" />
            </div>
            <button
              type="button"
              style={{ width: `${sizeWidth}px` }}
              onClick={() => toggleSort('size')}
              className="flex items-center justify-end gap-1 px-1 hover:text-slate-200 cursor-pointer transition-colors shrink-0 truncate"
            >
              <span>Size</span>
              {sortKey === 'size' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
            </button>
          </div>
        )}

        {showModified && (
          <div className="flex items-center h-full shrink-0">
            <div
              onMouseDown={(e) => handleResizeColumnStart('modified', e)}
              className="relative w-2 h-full cursor-col-resize flex items-center justify-center group/col shrink-0"
              title="Drag to resize column"
            >
              <div className="w-[1px] h-3.5 bg-[#2e3044] group-hover/col:bg-indigo-400 group-hover/col:w-[2px] transition-all" />
            </div>
            <button
              type="button"
              style={{ width: `${modifiedWidth}px` }}
              onClick={() => toggleSort('modified')}
              className="flex items-center justify-end gap-1 pr-1 pl-1 hover:text-slate-200 cursor-pointer transition-colors shrink-0 truncate"
            >
              <span>Modified</span>
              {sortKey === 'modified' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
            </button>
          </div>
        )}
      </div>

      {/* Column Visibility / Reset Header Menu */}
      {headerMenuPos && (
        <div
          ref={headerMenuRef}
          style={{ top: `${headerMenuPos.y}px`, left: `${headerMenuPos.x}px` }}
          className="fixed z-50 min-w-[140px] rounded-md bg-[#181824] border border-[#2e2f42] p-1 shadow-2xl text-xs text-slate-300 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] text-slate-500 font-mono uppercase tracking-wider border-b border-[#252636] mb-1">
            Columns
          </div>
          <button
            type="button"
            onClick={toggleShowSize}
            className="flex w-full items-center justify-between px-2 py-1 rounded hover:bg-[#252538] hover:text-white transition-colors cursor-pointer text-left text-xs"
          >
            <span>Size</span>
            {showSize && <Check className="h-3 w-3 text-indigo-400" />}
          </button>
          <button
            type="button"
            onClick={toggleShowModified}
            className="flex w-full items-center justify-between px-2 py-1 rounded hover:bg-[#252538] hover:text-white transition-colors cursor-pointer text-left text-xs"
          >
            <span>Modified</span>
            {showModified && <Check className="h-3 w-3 text-indigo-400" />}
          </button>
          <div className="my-1 border-t border-[#252636]" />
          <button
            type="button"
            onClick={() => {
              resetColumns();
              setHeaderMenuPos(null);
            }}
            className="flex w-full items-center gap-1.5 px-2 py-1 rounded hover:bg-[#252538] hover:text-white transition-colors cursor-pointer text-left text-[11px] text-slate-400"
          >
            <RotateCcw className="h-3 w-3 text-slate-400" />
            <span>Reset Columns</span>
          </button>
        </div>
      )}

      {/* File Tree List */}
      <div
        ref={parentRef}
        onContextMenu={handlePaneContextMenu}
        className="flex-1 overflow-y-auto relative w-full bg-[#1e1e2d]"
      >
        {isLoading && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span className="font-mono text-[11px]">Loading...</span>
          </div>
        ) : error ? (
          <div className="p-2.5 m-2 text-xs font-mono text-rose-300 bg-rose-950/40 border border-rose-800 rounded-md">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500 text-xs font-mono">
            Empty folder
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = sortedEntries[virtualRow.index];
              return (
                <div
                  key={entry.path}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <FileItemRow
                    entry={entry}
                    isSelected={selectedPaths.includes(entry.path)}
                    isRemote={isRemote}
                    selectedPaths={selectedPaths}
                    onSelect={handleRowSelect}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleRowContextMenu}
                    onDropOnFolder={(folderPath, src, paths) => {
                      if (onDropTransfer) {
                        onDropTransfer(src, paths, folderPath);
                      }
                    }}
                    onStartNativeDrag={onStartNativeDrag}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          targetEntry={contextMenu.targetEntry}
          isRemote={isRemote}
          onClose={() => setContextMenu(null)}
          onOpenExternal={onOpenExternal}
          onCopyFiles={onCopyFiles}
          onEdit={onEditFile}
          onTransfer={onTransferItem}
          onRename={onRenameItem}
          onChmod={onChmodItem}
          onDelete={onDeleteItem}
          onBookmarkFolder={onBookmarkFolder}
          onNewFile={onNewFile}
          onNewFolder={onNewFolder}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
