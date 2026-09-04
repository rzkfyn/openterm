import React from 'react';
import { FileEntry } from '../../types';
import { Folder, File, FileText, FileCode, Archive, HardDrive } from 'lucide-react';

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
      return <Folder className="h-4 w-4 text-sky-400 fill-sky-400/20 shrink-0" />;
    }
    const ext = entry.name.split('.').pop()?.toLowerCase();
    if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext || '')) {
      return <Archive className="h-4 w-4 text-amber-400 shrink-0" />;
    }
    if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'go', 'c', 'cpp'].includes(ext || '')) {
      return <FileCode className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    if (['txt', 'md', 'log'].includes(ext || '')) {
      return <FileText className="h-4 w-4 text-slate-300 shrink-0" />;
    }
    return <File className="h-4 w-4 text-slate-400 shrink-0" />;
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
      className={`flex h-8 items-center px-2 text-xs select-none cursor-pointer border-b border-slate-900/60 ${
        isSelected
          ? 'bg-sky-950/80 text-sky-200 border-sky-800/50'
          : 'text-slate-300 hover:bg-slate-900/60 hover:text-slate-100'
      }`}
    >
      <div className="flex flex-1 items-center space-x-2 truncate pr-2">
        {getIcon()}
        <span className="truncate">{entry.name}</span>
      </div>
      <div className="w-20 text-right text-slate-400 font-mono text-[11px] shrink-0">
        {formatSize(entry.size)}
      </div>
      <div className="w-28 text-right text-slate-500 text-[10px] shrink-0 pl-2">
        {formatDate(entry.modified)}
      </div>
    </div>
  );
};
