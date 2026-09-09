import React, { useEffect, useRef } from 'react';
import {
  FileEdit,
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Shield,
  Trash2,
  FilePlus,
  FolderPlus,
  RotateCw,
  Copy,
  Bookmark,
} from 'lucide-react';
import { FileEntry } from '../../types';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  targetEntry?: FileEntry | null;
  isRemote: boolean;
  onClose: () => void;
  onEdit?: (entry: FileEntry) => void;
  onTransfer?: (entry: FileEntry) => void;
  onRename?: (entry: FileEntry) => void;
  onChmod?: (entry: FileEntry) => void;
  onDelete?: (entry: FileEntry) => void;
  onBookmarkFolder?: (entry: FileEntry) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onRefresh?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  targetEntry,
  isRemote,
  onClose,
  onEdit,
  onTransfer,
  onRename,
  onChmod,
  onDelete,
  onBookmarkFolder,
  onNewFile,
  onNewFolder,
  onRefresh,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust positioning to not overflow viewport
  const style: React.CSSProperties = {
    top: Math.min(position.y, window.innerHeight - 250),
    left: Math.min(position.x, window.innerWidth - 180),
  };

  const handleCopyPath = () => {
    if (targetEntry) {
      navigator.clipboard.writeText(targetEntry.path);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-50 min-w-[160px] rounded-md bg-[#181824] border border-[#2e2f42] p-1 shadow-2xl text-xs text-slate-300 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {targetEntry ? (
        <>
          {/* Target File/Folder Info Header */}
          <div className="px-2 py-1 text-[10px] text-slate-500 font-mono truncate border-b border-[#252636] mb-1">
            {targetEntry.name}
          </div>

          {!targetEntry.isDir && onEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <FileEdit className="h-3.5 w-3.5" />
              <span>Edit File</span>
            </button>
          )}

          {onTransfer && (
            <button
              type="button"
              onClick={() => {
                onTransfer(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              {isRemote ? (
                <>
                  <ArrowDownToLine className="h-3.5 w-3.5 text-sky-400" />
                  <span>Download</span>
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Upload</span>
                </>
              )}
            </button>
          )}

          {onRename && (
            <button
              type="button"
              onClick={() => {
                onRename(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Rename</span>
            </button>
          )}

          {isRemote && onChmod && (
            <button
              type="button"
              onClick={() => {
                onChmod(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span>Permissions</span>
            </button>
          )}

          {targetEntry.isDir && onBookmarkFolder && (
            <button
              type="button"
              onClick={() => {
                onBookmarkFolder(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-amber-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <Bookmark className="h-3.5 w-3.5 text-amber-400" />
              <span>Bookmark Folder</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyPath}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" />
            <span>Copy Path</span>
          </button>

          <div className="my-1 border-t border-[#252636]" />

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(targetEntry);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-rose-600 hover:text-white text-rose-300 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </>
      ) : (
        <>
          {onNewFile && (
            <button
              type="button"
              onClick={() => {
                onNewFile();
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <FilePlus className="h-3.5 w-3.5 text-indigo-400" />
              <span>New File</span>
            </button>
          )}

          {onNewFolder && (
            <button
              type="button"
              onClick={() => {
                onNewFolder();
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
              <span>New Folder</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={() => {
                onRefresh();
                onClose();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <RotateCw className="h-3.5 w-3.5 text-slate-400" />
              <span>Refresh</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
