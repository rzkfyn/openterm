import React, { useRef, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry } from '../../types';
import { FileItemRow } from './FileItemRow';
import { PathBreadcrumb } from './PathBreadcrumb';
import { ContextMenu, ContextMenuPosition } from './ContextMenu';
import { Loader2, ChevronUp, ChevronDown, ArrowDownToLine, Search, X } from 'lucide-react';

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
  onSelect: (paths: string[]) => void;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onDropTransfer?: (source: 'local' | 'remote', paths: string[], targetFolder?: string) => void;
  onEditFile?: (entry: FileEntry) => void;
  onTransferItem?: (entry: FileEntry) => void;
  onRenameItem?: (entry: FileEntry) => void;
  onChmodItem?: (entry: FileEntry) => void;
  onDeleteItem?: (entry: FileEntry) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
}

export const FilePane: React.FC<FilePaneProps> = ({
  title,
  isRemote = false,
  currentPath,
  entries,
  total,
  isLoading,
  error,
  selectedPaths,
  onSelect,
  onNavigate,
  onRefresh,
  onDropTransfer,
  onEditFile,
  onTransferItem,
  onRenameItem,
  onChmodItem,
  onDeleteItem,
  onNewFile,
  onNewFolder,
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return entries;
    const q = searchFilter.toLowerCase().trim();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
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

    // Search Toggle (Ctrl+F / Cmd+F)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      setIsSearchVisible((prev) => {
        const next = !prev;
        if (next) {
          setTimeout(() => searchInputRef.current?.focus(), 50);
        } else {
          setSearchFilter('');
        }
        return next;
      });
      return;
    }

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

    // 2. External OS drop (e.g. Windows Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        const localPath = (f as any).path;
        if (localPath) {
          paths.push(localPath);
        }
      }
      if (paths.length > 0) {
        onDropTransfer('local', paths, currentPath);
      }
    }
  };

  return (
    <div
      ref={paneContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-1 flex-col h-full bg-[#1e1e2d] overflow-hidden select-none outline-none transition-colors ${
        isPaneDragOver ? 'ring-2 ring-indigo-500/80 bg-[#252538]' : ''
      }`}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={handlePaneDrop}
    >
      {/* Visual Dropzone Overlay Banner when dragging */}
      {isPaneDragOver && (
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
      />

      {/* Column Headers */}
      <div className="flex h-[22px] items-center px-3 bg-[#171724] border-b border-[#2a2b38] text-[10px] font-mono text-slate-400 select-none">
        <button
          type="button"
          onClick={() => toggleSort('name')}
          className="flex flex-1 items-center gap-1 hover:text-slate-200 cursor-pointer transition-colors"
        >
          <span>Name</span>
          {sortKey === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
        </button>
        <button
          type="button"
          onClick={() => toggleSort('size')}
          className="flex w-16 items-center justify-end gap-1 hover:text-slate-200 cursor-pointer transition-colors"
        >
          <span>Size</span>
          {sortKey === 'size' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
        </button>
        <button
          type="button"
          onClick={() => toggleSort('modified')}
          className="flex w-24 items-center justify-end gap-1 pr-1 hover:text-slate-200 cursor-pointer transition-colors"
        >
          <span>Modified</span>
          {sortKey === 'modified' && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
        </button>
      </div>

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
          onEdit={onEditFile}
          onTransfer={onTransferItem}
          onRename={onRenameItem}
          onChmod={onChmodItem}
          onDelete={onDeleteItem}
          onNewFile={onNewFile}
          onNewFolder={onNewFolder}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
