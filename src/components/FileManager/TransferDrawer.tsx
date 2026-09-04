import React from 'react';
import { useTransferStore } from '../../stores/transferStore';
import { ArrowDownRight, ArrowUpRight, Check, AlertCircle, X } from 'lucide-react';

export const TransferDrawer: React.FC = () => {
  const { transfers, cancelTransfer, clearCompleted } = useTransferStore();
  const list = Object.values(transfers);

  if (list.length === 0) return null;

  const activeCount = list.filter((t) => t.status === 'transferring' || t.status === 'pending').length;

  return (
    <div className="flex flex-col border-t border-white/[0.08] bg-[#030712]/95 backdrop-blur-2xl text-xs text-slate-300 max-h-48 overflow-y-auto z-20">
      <div className="flex h-8 items-center justify-between px-4 bg-white/[0.02] border-b border-white/[0.04] text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-2.5">
          <span className="font-semibold text-slate-200">Native Transfers (Direct-to-Disk)</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] text-emerald-400 font-mono">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={clearCompleted}
          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
        >
          Clear Finished
        </button>
      </div>

      <div className="divide-y divide-white/[0.03]">
        {list.map((t) => {
          const isDownload = t.transferId.startsWith('dl');
          return (
            <div key={t.transferId} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center space-x-2.5 truncate flex-1 pr-6">
                {isDownload ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                    <ArrowDownRight className="h-3 w-3 stroke-[2]" />
                  </div>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <ArrowUpRight className="h-3 w-3 stroke-[2]" />
                  </div>
                )}
                <span className="truncate font-mono text-[11px] text-slate-200">{t.fileName}</span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {Math.round(t.percentage)}%
                </span>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="w-28 bg-white/[0.05] h-1.5 rounded-full overflow-hidden border border-white/[0.05]">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      t.status === 'completed'
                        ? 'bg-emerald-400'
                        : t.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, t.percentage)}%` }}
                  />
                </div>

                {t.status === 'completed' && (
                  <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[2.5]" />
                )}
                {t.status === 'failed' && (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" title={t.error} />
                )}
                {(t.status === 'transferring' || t.status === 'pending') && (
                  <button
                    onClick={() => cancelTransfer(t.transferId)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-white/[0.06] transition-colors"
                    title="Cancel transfer"
                  >
                    <X className="h-3.5 w-3.5 stroke-[1.5]" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
