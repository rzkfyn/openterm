import React from 'react';
import { useTransferStore } from '../../stores/transferStore';
import { ArrowDownRight, ArrowUpRight, Check, AlertCircle, X } from 'lucide-react';

export const TransferDrawer: React.FC = () => {
  const { transfers, cancelTransfer, clearCompleted } = useTransferStore();
  const list = Object.values(transfers);

  if (list.length === 0) return null;

  const activeCount = list.filter((t) => t.status === 'transferring' || t.status === 'pending').length;

  return (
    <div className="flex flex-col border-t border-[#2a2b38] bg-[#171724] text-xs text-slate-300 max-h-40 overflow-y-auto select-none">
      {/* Drawer Header */}
      <div className="flex h-[26px] items-center justify-between px-3 bg-[#11111a] border-b border-[#2a2b38] text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
            File Transfers
          </span>
          {activeCount > 0 && (
            <span className="rounded bg-indigo-500/20 border border-indigo-500/40 px-1.5 py-0.2 text-[9px] text-indigo-300 font-mono">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clearCompleted}
          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#252538] cursor-pointer transition-colors"
        >
          Clear Finished
        </button>
      </div>

      {/* Transfer Rows */}
      <div className="divide-y divide-[#2a2b38]">
        {list.map((t) => {
          const isDownload = t.transferId.startsWith('dl');
          return (
            <div key={t.transferId} className="flex items-center justify-between px-3 py-1.5 hover:bg-[#1e1e2d] transition-colors">
              <div className="flex items-center gap-2 truncate flex-1 pr-4">
                {isDownload ? (
                  <ArrowDownRight className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate font-mono text-[11px] text-slate-200">{t.fileName}</span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {Math.round(t.percentage)}%
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 bg-[#11111a] h-1.5 rounded-full overflow-hidden border border-[#2a2b38]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      t.status === 'completed'
                        ? 'bg-emerald-400'
                        : t.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, t.percentage)}%` }}
                  />
                </div>

                {t.status === 'completed' && (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {t.status === 'failed' && (
                  <span title={t.error}>
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                  </span>
                )}
                {(t.status === 'transferring' || t.status === 'pending') && (
                  <button
                    type="button"
                    onClick={() => cancelTransfer(t.transferId)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer transition-colors"
                    title="Cancel transfer"
                  >
                    <X className="h-3 w-3" />
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
