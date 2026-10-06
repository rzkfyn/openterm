import React from 'react';
import { Download, Loader2, RotateCw, AlertTriangle } from 'lucide-react';
import { useAppUpdateStore } from '../../stores/appUpdateStore';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  /** Fallback when in-app install fails: open the release page. */
  onOpenRelease?: () => void;
  compact?: boolean;
}

/** Install / progress / restart control for an available update. */
export const UpdateInstallButton: React.FC<Props> = ({ onOpenRelease, compact = false }) => {
  const { phase, progress, error, installUpdate, restartApp, reset } = useAppUpdateStore();
  const openSessions = useSessionStore((s) => s.activeSessions.length);

  const confirmSessions = (action: string) =>
    openSessions === 0 ||
    window.confirm(
      `${action} will close ${openSessions} open session${openSessions === 1 ? '' : 's'}. Continue?`
    );

  const base = compact
    ? 'flex items-center gap-1.5 px-2 py-0.5 text-[10px] transition-colors cursor-pointer'
    : 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer';
  const primary = compact
    ? 'text-indigo-300 hover:text-white hover:bg-[#25263a]'
    : 'text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20';

  if (phase === 'checking' || phase === 'downloading') {
    const pct = progress === null ? null : Math.round(progress * 100);
    return (
      <span className={`${base} ${compact ? 'text-slate-300' : 'text-slate-200 bg-white/5'} cursor-default`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{phase === 'checking' ? 'Preparing…' : pct === null ? 'Downloading…' : `Downloading ${pct}%`}</span>
      </span>
    );
  }

  if (phase === 'ready') {
    return (
      <button
        type="button"
        onClick={() => confirmSessions('Restarting') && restartApp()}
        className={`${base} ${primary}`}
        title="Update installed. Restart to finish."
      >
        <RotateCw className="h-3 w-3" />
        <span>Restart to update</span>
      </button>
    );
  }

  if (phase === 'error') {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          onOpenRelease?.();
        }}
        className={`${base} text-rose-300 hover:text-rose-200 ${compact ? 'hover:bg-[#25263a]' : 'bg-rose-500/10'}`}
        title={`Update failed: ${error ?? 'unknown error'}. Click to download manually.`}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>{onOpenRelease ? 'Failed: download manually' : 'Update failed'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      // Windows exits the app while installing, so warn up front.
      onClick={() => confirmSessions('Installing the update') && installUpdate()}
      className={`${base} ${primary}`}
      title="Download and install the update"
    >
      <Download className="h-3 w-3" />
      <span>{compact ? 'Install' : 'Install Update'}</span>
    </button>
  );
};
