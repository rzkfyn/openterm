import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ConflictAction, FileStatInfo } from '../../types';

export interface ConflictDetails {
  fileName: string;
  sourcePath: string;
  destPath: string;
  isUpload: boolean;
  sourceStat: { size: number; modified?: number };
  destStat: FileStatInfo;
}

interface TransferConflictModalProps {
  isOpen: boolean;
  conflict: ConflictDetails | null;
  onResolve: (action: ConflictAction, applyToAll: boolean) => void;
  onCancel: () => void;
}

export const TransferConflictModal: React.FC<TransferConflictModalProps> = ({
  isOpen,
  conflict,
  onResolve,
  onCancel,
}) => {
  const [selectedAction, setSelectedAction] = useState<ConflictAction>('overwrite');
  const [applyToAll, setApplyToAll] = useState(false);

  if (!isOpen || !conflict) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (secs?: number) => {
    if (!secs) return 'Unknown';
    const d = new Date(secs * 1000);
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResolve(selectedAction, applyToAll);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="w-full max-w-lg rounded-lg bg-[#181824] border border-[#2e2f42] p-5 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Transfer Conflict: Target Exists
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="text-xs text-slate-300">
            A file named <span className="font-mono text-indigo-300 font-semibold">{conflict.fileName}</span> already exists at the destination.
          </div>

          {/* Source vs Destination Comparison Card */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-[#11111a] border border-[#262738] text-xs">
            {/* Source */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Source File ({conflict.isUpload ? 'Local' : 'Remote'})
              </div>
              <div className="font-mono text-slate-200 truncate">{conflict.fileName}</div>
              <div className="text-slate-400">Size: <span className="text-slate-200 font-mono">{formatSize(conflict.sourceStat.size)}</span></div>
              <div className="text-slate-400">Modified: <span className="text-slate-200 font-mono">{formatDate(conflict.sourceStat.modified)}</span></div>
            </div>

            {/* Destination */}
            <div className="space-y-1 border-l border-[#262738] pl-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Existing Destination
              </div>
              <div className="font-mono text-slate-200 truncate">{conflict.fileName}</div>
              <div className="text-slate-400">Size: <span className="text-slate-200 font-mono">{formatSize(conflict.destStat.size)}</span></div>
              <div className="text-slate-400">Modified: <span className="text-slate-200 font-mono">{formatDate(conflict.destStat.modified)}</span></div>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-2 text-xs font-sans">
            <label className="flex items-center gap-2.5 p-2 rounded hover:bg-[#202030] cursor-pointer transition-colors border border-transparent hover:border-[#2e2f42]">
              <input
                type="radio"
                name="conflictAction"
                value="overwrite"
                checked={selectedAction === 'overwrite'}
                onChange={() => setSelectedAction('overwrite')}
                className="accent-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-200">Overwrite</span>
                <p className="text-[11px] text-slate-400">Replace existing target file completely.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded hover:bg-[#202030] cursor-pointer transition-colors border border-transparent hover:border-[#2e2f42]">
              <input
                type="radio"
                name="conflictAction"
                value="overwrite_newer"
                checked={selectedAction === 'overwrite_newer'}
                onChange={() => setSelectedAction('overwrite_newer')}
                className="accent-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-200">Overwrite if source is newer</span>
                <p className="text-[11px] text-slate-400">Only overwrite if source modified date is more recent.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded hover:bg-[#202030] cursor-pointer transition-colors border border-transparent hover:border-[#2e2f42]">
              <input
                type="radio"
                name="conflictAction"
                value="overwrite_size"
                checked={selectedAction === 'overwrite_size'}
                onChange={() => setSelectedAction('overwrite_size')}
                className="accent-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-200">Overwrite if size differs</span>
                <p className="text-[11px] text-slate-400">Overwrite only if source and destination file sizes do not match.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded hover:bg-[#202030] cursor-pointer transition-colors border border-transparent hover:border-[#2e2f42]">
              <input
                type="radio"
                name="conflictAction"
                value="rename"
                checked={selectedAction === 'rename'}
                onChange={() => setSelectedAction('rename')}
                className="accent-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-200">Auto-rename</span>
                <p className="text-[11px] text-slate-400">Save with indexed suffix (e.g. &apos;filename (1).ext&apos;).</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded hover:bg-[#202030] cursor-pointer transition-colors border border-transparent hover:border-[#2e2f42]">
              <input
                type="radio"
                name="conflictAction"
                value="skip"
                checked={selectedAction === 'skip'}
                onChange={() => setSelectedAction('skip')}
                className="accent-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-200">Skip</span>
                <p className="text-[11px] text-slate-400">Leave existing destination file untouched and do not transfer.</p>
              </div>
            </label>
          </div>

          {/* Apply to all in session / queue */}
          <div className="pt-2 border-t border-[#262738]">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              <span>Apply this action to all remaining transfers in current queue</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded bg-[#252636] hover:bg-[#2e3046] text-slate-300 transition-colors"
            >
              Cancel Transfer
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Apply Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
