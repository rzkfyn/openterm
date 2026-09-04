import React from 'react';
import { useTransferStore } from '../../stores/transferStore';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle, X } from 'lucide-react';

export const TransferDrawer: React.FC = () => {
  const { transfers, cancelTransfer, clearCompleted } = useTransferStore();
  const list = Object.values(transfers);

  if (list.length === 0) return null;

  const activeCount = list.filter((t) => t.status === 'transferring' || t.status === 'pending').length;

  return (
    <div className="flex flex-col border-t border-slate-800 bg-slate-900/95 text-xs text-slate-300 max-h-48 overflow-y-auto">
      <div className="flex h-7 items-center justify-between px-3 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
        <div className="flex items-center space-x-2">
          <span>Transfers</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] text-sky-400">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={clearCompleted}
          className="text-[10px] text-slate-400 hover:text-slate-200"
        >
          Clear Finished
        </button>
      </div>

      <div className="divide-y divide-slate-850">
        {list.map((t) => {
          const isDownload = t.transferId.startsWith('dl');
          return (
            <div key={t.transferId} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/40">
              <div className="flex items-center space-x-2 truncate flex-1 pr-4">
                {isDownload ? (
                  <ArrowDownCircle className="h-4 w-4 text-sky-400 shrink-0" />
                ) : (
                  <ArrowUpCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                <span className="truncate font-mono">{t.fileName}</span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {Math.round(t.percentage)}%
                </span>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      t.status === 'completed'
                        ? 'bg-emerald-500'
                        : t.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-sky-500'
                    }`}
                    style={{ width: `${Math.min(100, t.percentage)}%` }}
                  />
                </div>

                {t.status === 'completed' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {t.status === 'failed' && (
                  <XCircle className="h-3.5 w-3.5 text-rose-400" title={t.error} />
                )}
                {(t.status === 'transferring' || t.status === 'pending') && (
                  <button
                    onClick={() => cancelTransfer(t.transferId)}
                    className="p-0.5 text-slate-500 hover:text-rose-400"
                    title="Cancel"
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
