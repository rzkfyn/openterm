import React, { useEffect, useRef } from 'react';
import { Copy, Clipboard, CheckSquare, Trash2, RotateCcw } from 'lucide-react';

export interface TerminalContextMenuPosition {
  x: number;
  y: number;
}

interface TerminalContextMenuProps {
  position: TerminalContextMenuPosition;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({
  position,
  hasSelection,
  onCopy,
  onPaste,
  onSelectAll,
  onClear,
  onReset,
  onClose,
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

  // Adjust menu coordinates so it doesn't clip screen boundaries
  const adjustedX = Math.min(position.x, window.innerWidth - 180);
  const adjustedY = Math.min(position.y, window.innerHeight - 200);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 min-w-[170px] rounded-md bg-[#181824] border border-[#2a2b38] p-1 shadow-2xl text-xs text-slate-300 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        type="button"
        disabled={!hasSelection}
        onClick={() => {
          onCopy();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-left hover:bg-[#252538] hover:text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Copy className="h-3.5 w-3.5 text-slate-400" />
        <span className="flex-1">Copy</span>
        <span className="text-[10px] font-mono text-slate-500">Ctrl+Shift+C</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onPaste();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-left hover:bg-[#252538] hover:text-white cursor-pointer transition-colors"
      >
        <Clipboard className="h-3.5 w-3.5 text-slate-400" />
        <span className="flex-1">Paste</span>
        <span className="text-[10px] font-mono text-slate-500">Ctrl+V</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onSelectAll();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-left hover:bg-[#252538] hover:text-white cursor-pointer transition-colors"
      >
        <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
        <span className="flex-1">Select All</span>
        <span className="text-[10px] font-mono text-slate-500">Ctrl+Shift+A</span>
      </button>

      <div className="my-1 border-t border-[#2a2b38]" />

      <button
        type="button"
        onClick={() => {
          onClear();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-left hover:bg-[#252538] hover:text-white cursor-pointer transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5 text-slate-400" />
        <span>Clear Buffer</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onReset();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-left hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 cursor-pointer transition-colors"
        title="Reset PTY state and disable stuck mouse tracking escape modes"
      >
        <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
        <span>Reset Terminal</span>
      </button>
    </div>
  );
};
