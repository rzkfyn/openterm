import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';

interface ChmodModalProps {
  isOpen: boolean;
  fileName: string;
  currentMode?: number;
  onConfirm: (mode: number) => void;
  onClose: () => void;
}

export const ChmodModal: React.FC<ChmodModalProps> = ({
  isOpen,
  fileName,
  currentMode = 0o644,
  onConfirm,
  onClose,
}) => {
  // Extract lower 9 bits (rwxrwxrwx)
  const initialPerms = (currentMode || 0o644) & 0o777;

  const [ownerR, setOwnerR] = useState(Boolean(initialPerms & 0o400));
  const [ownerW, setOwnerW] = useState(Boolean(initialPerms & 0o200));
  const [ownerX, setOwnerX] = useState(Boolean(initialPerms & 0o100));

  const [groupR, setGroupR] = useState(Boolean(initialPerms & 0o040));
  const [groupW, setGroupW] = useState(Boolean(initialPerms & 0o020));
  const [groupX, setGroupX] = useState(Boolean(initialPerms & 0o010));

  const [othersR, setOthersR] = useState(Boolean(initialPerms & 0o004));
  const [othersW, setOthersW] = useState(Boolean(initialPerms & 0o002));
  const [othersX, setOthersX] = useState(Boolean(initialPerms & 0o001));

  if (!isOpen) return null;

  // Compute octal
  const ownerVal = (ownerR ? 4 : 0) + (ownerW ? 2 : 0) + (ownerX ? 1 : 0);
  const groupVal = (groupR ? 4 : 0) + (groupW ? 2 : 0) + (groupX ? 1 : 0);
  const othersVal = (othersR ? 4 : 0) + (othersW ? 2 : 0) + (othersX ? 1 : 0);
  const octalMode = (ownerVal << 6) | (groupVal << 3) | othersVal;
  const octalString = `0${ownerVal}${groupVal}${othersVal}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(octalMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-lg bg-[#1a1a26] border border-[#2e2f42] p-4 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Change Permissions
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div className="text-xs text-slate-400 truncate">
            Target: <span className="font-mono text-slate-200 font-semibold">{fileName}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="text-left font-sans text-slate-400">Class</div>
            <div className="text-slate-400">Read (4)</div>
            <div className="text-slate-400">Write (2)</div>
            <div className="text-slate-400">Exec (1)</div>

            {/* Owner */}
            <div className="text-left font-sans text-slate-300">Owner</div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerR}
                onChange={(e) => setOwnerR(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerW}
                onChange={(e) => setOwnerW(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerX}
                onChange={(e) => setOwnerX(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Group */}
            <div className="text-left font-sans text-slate-300">Group</div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupR}
                onChange={(e) => setGroupR(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupW}
                onChange={(e) => setGroupW(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupX}
                onChange={(e) => setGroupX(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Others */}
            <div className="text-left font-sans text-slate-300">Public</div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersR}
                onChange={(e) => setOthersR(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersW}
                onChange={(e) => setOthersW(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersX}
                onChange={(e) => setOthersX(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#11111a] border border-[#2e2f42] rounded px-3 py-2 text-xs">
            <span className="text-slate-400">Octal Mode:</span>
            <span className="font-mono text-indigo-400 font-bold">{octalString}</span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-[#252636] hover:bg-[#2e3046] text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Apply (chmod)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
