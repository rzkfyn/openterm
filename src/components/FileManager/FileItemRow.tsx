import React, { useState } from 'react';
import { FileEntry } from '../../types';
import { Folder, File, FileCode, Archive } from 'lucide-react';

interface FileItemRowProps {
  entry: FileEntry;
  isSelected: boolean;
  isRemote?: boolean;
  selectedPaths: string[];
  onSelect: (entry: FileEntry, event: React.MouseEvent) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu?: (entry: FileEntry, event: React.MouseEvent) => void;
  onDropOnFolder?: (targetFolder: string, source: 'local' | 'remote', paths: string[]) => void;
}

export const FileItemRow: React.FC<FileItemRowProps> = ({
  entry,
  isSelected,
  isRemote = false,
  selectedPaths,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onDropOnFolder,
}) => {
  const [isFolderDragOver, setIsFolderDragOver] = useState(false);

  const getIcon = () => {
    if (entry.isDir) {
      return (
        <Folder className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
      );
    }
    const ext = entry.name.split('.').pop()?.toLowerCase();
    if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext || '')) {
      return (
        <Archive className="h-3.5 w-3.5 text-rose-400 shrink-0" />
      );
    }
    if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'go', 'c', 'cpp'].includes(ext || '')) {
      return (
        <FileCode className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
      );
    }
    return (
      <File className="h-3.5 w-3.5 text-slate-400 shrink-0" />
    );
  };

  const formatSize = (bytes: number) => {
    if (entry.isDir) return '--';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (secs?: number) => {
    if (!secs) return '--';
    const d = new Date(secs * 1000);
    return d.toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDragStart = (e: React.DragEvent) => {
    const pathsToTransfer = isSelected && selectedPaths.includes(entry.path)
      ? selectedPaths
      : [entry.path];

    const payload = JSON.stringify({
      source: isRemote ? 'remote' : 'local',
      paths: pathsToTransfer,
    });

    e.dataTransfer.setData('application/x-openterm-transfer', payload);
    e.dataTransfer.setData('text/plain', pathsToTransfer.join('\n'));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (entry.isDir && onDropOnFolder) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isFolderDragOver) setIsFolderDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (entry.isDir) {
      e.preventDefault();
      e.stopPropagation();
      setIsFolderDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (entry.isDir && onDropOnFolder) {
      e.preventDefault();
      e.stopPropagation();
      setIsFolderDragOver(false);

      // 1. Internal transfer
      try {
        const raw = e.dataTransfer.getData('application/x-openterm-transfer');
        if (raw) {
          const { source, paths } = JSON.parse(raw);
          onDropOnFolder(entry.path, source, paths);
          return;
        }
      } catch (err) {
        console.error('Failed to parse drag drop data:', err);
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
          onDropOnFolder(entry.path, 'local', paths);
        }
      }
    }
  };

  return (
    <div
      draggable
      data-file-row="true"
      data-is-dir={entry.isDir ? 'true' : 'false'}
      data-is-remote={isRemote ? 'true' : 'false'}
      data-entry-path={entry.path}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => onSelect(entry, e)}
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(entry, e);
        }
      }}
      className={`group flex h-[24px] items-center px-3 text-xs select-none cursor-pointer transition-colors ${
        isFolderDragOver
          ? 'bg-indigo-500/25 border-2 border-indigo-500 text-white'
          : isSelected
          ? 'bg-[#2a2b42] text-white border-l-2 border-l-indigo-400'
          : 'text-slate-300 hover:bg-[#232336] hover:text-white'
      }`}
    >
      <div className="flex flex-1 items-center gap-2 truncate pr-2">
        {getIcon()}
        <span className="truncate font-sans text-xs">{entry.name}</span>
      </div>
      <div className="w-16 text-right text-slate-500 font-mono text-[10px] shrink-0">
        {formatSize(entry.size)}
      </div>
      <div className="w-24 text-right text-slate-500 font-mono text-[10px] shrink-0 pr-1">
        {formatDate(entry.modified)}
      </div>
    </div>
  );
};
