import React, { useRef, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry } from '../../types';
import { FileItemRow } from './FileItemRow';
import { PathBreadcrumb } from './PathBreadcrumb';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';

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
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      // Folders always first regardless of sort
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
  }, [entries, sortKey, sortDir]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

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
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full p-1 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] overflow-hidden">
      <div className="flex flex-1 flex-col rounded-[calc(1.5rem-0.25rem)] bg-[#050811] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden">
        {/* Pane Header */}
        <div className="flex h-8 items-center justify-between bg-white/[0.02] px-4 border-b border-white/[0.06] text-xs select-none">
          <div className="flex items-center space-x-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isRemote ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'}`} />
            <span className="font-semibold text-slate-200 tracking-tight">{title}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {entries.length} / {total} entries
          </span>
        </div>

        {/* Path Breadcrumbs */}
        <PathBreadcrumb
          path={currentPath}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          isRemote={isRemote}
        />

        {/* Table Column Headers */}
        <div className="flex h-6 items-center px-4 bg-white/[0.01] border-b border-white/[0.04] text-[9px] font-mono font-medium text-slate-500 uppercase tracking-widest select-none">
          <button onClick={() => toggleSort('name')} className="flex flex-1 items-center gap-1 hover:text-slate-300 transition-colors">
            <span>Name</span>
            {sortKey === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          </button>
          <button onClick={() => toggleSort('size')} className="flex w-20 items-center justify-end gap-1 hover:text-slate-300 transition-colors">
            <span>Size</span>
            {sortKey === 'size' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          </button>
          <button onClick={() => toggleSort('modified')} className="flex w-28 items-center justify-end gap-1 pr-2 hover:text-slate-300 transition-colors">
            <span>Modified</span>
            {sortKey === 'modified' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          </button>
        </div>

        {/* Virtualized File List */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto relative w-full bg-[#03060e]"
        >
          {isLoading && entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500 text-xs space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span className="font-mono text-[11px]">Querying file system...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-xs font-mono text-rose-400 bg-rose-950/20 border border-rose-900/50 m-3 rounded-xl">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600 text-xs font-mono">
              Empty directory
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
                      onSelect={handleRowSelect}
                      onDoubleClick={handleDoubleClick}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
