import React from 'react';
import { FileEntry } from '../../types';
import { Folder, File, FileText, FileCode, Archive } from 'lucide-react';

interface FileItemRowProps {
  entry: FileEntry;
  isSelected: boolean;
  onSelect: (entry: FileEntry, event: React.MouseEvent) => void;
  onDoubleClick: (entry: FileEntry) => void;
}

export const FileItemRow: React.FC<FileItemRowProps> = ({
  entry,
  isSelected,
  onSelect,
  onDoubleClick,
}) => {
  const getIcon = () => {
    if (entry.isDir) {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <Folder className="h-3.5 w-3.5 stroke-[1.5] fill-emerald-400/20" />
        </div>
      );
    }
    const ext = entry.name.split('.').pop()?.toLowerCase();
    if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext || '')) {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
          <Archive className="h-3.5 w-3.5 stroke-[1.5]" />
        </div>
      );
    }
    if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'go', 'c', 'cpp'].includes(ext || '')) {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
          <FileCode className="h-3.5 w-3.5 stroke-[1.5]" />
        </div>
      );
    }
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] shrink-0">
        <File className="h-3.5 w-3.5 stroke-[1.5]" />
      </div>
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      onClick={(e) => onSelect(entry, e)}
      onDoubleClick={() => onDoubleClick(entry)}
      className={`group flex h-8 items-center px-3 text-xs select-none cursor-pointer transition-colors duration-150 border-b border-white/[0.02] ${
        isSelected
          ? 'bg-emerald-500/15 text-white border-b-emerald-500/30'
          : 'text-slate-300 hover:bg-white/[0.03] hover:text-white'
      }`}
    >
      <div className="flex flex-1 items-center space-x-2.5 truncate pr-3">
        {getIcon()}
        <span className="truncate font-mono text-[11px] tracking-tight">{entry.name}</span>
      </div>
      <div className="w-20 text-right text-slate-500 font-mono text-[10px] shrink-0">
        {formatSize(entry.size)}
      </div>
      <div className="w-28 text-right text-slate-600 font-mono text-[10px] shrink-0 pl-2">
        {formatDate(entry.modified)}
      </div>
    </div>
  );
};
