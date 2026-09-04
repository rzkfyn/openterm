import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileEntry } from '../../types';
import { FileItemRow } from './FileItemRow';
import { PathBreadcrumb } from './PathBreadcrumb';
import { Loader2 } from 'lucide-react';

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
  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtualizer for high-performance DOM virtualization
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
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
    <div className="flex flex-1 flex-col h-full bg-slate-950/70 border border-slate-800/80 rounded-sm overflow-hidden">
      {/* Pane Header */}
      <div className="flex h-7 items-center justify-between bg-slate-900/80 px-3 border-b border-slate-800 text-xs font-semibold text-slate-300">
        <span>{title}</span>
        <span className="text-[10px] font-normal text-slate-400">
          {entries.length} of {total} items
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
      <div className="flex h-6 items-center px-2 bg-slate-900/30 border-b border-slate-800/60 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
        <div className="flex-1">Name</div>
        <div className="w-20 text-right">Size</div>
        <div className="w-28 text-right pr-2">Modified</div>
      </div>

      {/* Virtualized File List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto relative w-full bg-[#070b14]"
      >
        {isLoading && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500 text-xs space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
            <span>Loading folder contents...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-900/50 m-2 rounded">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600 text-xs">
            Folder is empty
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
              const entry = entries[virtualRow.index];
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
  );
};
