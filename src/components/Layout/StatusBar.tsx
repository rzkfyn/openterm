import React from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useUpdateStore } from '../../stores/updateStore';
import { tauriApi } from '../../services/tauri';
import { Terminal, Columns, FolderTree, Wifi, WifiOff, ArrowUpCircle, X } from 'lucide-react';

const REPO_URL = 'https://github.com/rzkfyn/openterm';
const RELEASES_URL = 'https://github.com/rzkfyn/openterm/releases';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'h-3.5 w-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export const StatusBar: React.FC = () => {
  const { activeSessions, currentSessionId, viewMode, setViewMode } = useSessionStore();
  const { currentVersion, latestVersion, releaseUrl, hasUpdate, dismissed, dismissUpdate } = useUpdateStore();
  const currentSession = activeSessions.find((s) => s.id === currentSessionId);
  const isConnected = currentSession && currentSession.status !== 'disconnected';

  const handleOpenGithub = () => {
    tauriApi.openUrl(REPO_URL).catch(() => {
      window.open(REPO_URL, '_blank');
    });
  };

  const handleOpenReleases = () => {
    tauriApi.openUrl(RELEASES_URL).catch(() => {
      window.open(RELEASES_URL, '_blank');
    });
  };

  const handleOpenLatestRelease = () => {
    const targetUrl = releaseUrl || RELEASES_URL;
    tauriApi.openUrl(targetUrl).catch(() => {
      window.open(targetUrl, '_blank');
    });
  };

  return (
    <footer className="flex h-[24px] items-center justify-between px-2.5 bg-[#11111a] border-t border-[#2a2b38] text-[#94a3b8] text-[11px] select-none shrink-0 z-20">
      {/* Left: GitHub link + Version + Active Session Info */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenGithub}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-[#1e1e2d] transition-colors cursor-pointer"
            title="Open repository on GitHub (rzkfyn/openterm)"
          >
            <GithubIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleOpenReleases}
            className="font-mono text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="View OpenTerm release history"
          >
            v{currentVersion}
          </button>
        </div>

        {hasUpdate && !dismissed && latestVersion && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenLatestRelease}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer text-[10px] font-medium"
              title={`New version v${latestVersion} available! Click to view release.`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <ArrowUpCircle className="h-3 w-3 text-emerald-400" />
              <span>Update v{latestVersion}</span>
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              className="p-0.5 text-slate-500 hover:text-slate-300 rounded hover:bg-[#1e1e2d] transition-colors cursor-pointer"
              title="Dismiss update badge"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {currentSession && (
          <>
            <span className="text-[#2a2b38]">|</span>
            <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
              {isConnected ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="h-3 w-3" />
                  <span>{currentSession.username}@{currentSession.host}:{currentSession.port}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400">
                  <WifiOff className="h-3 w-3" />
                  <span>Disconnected</span>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: View Toggles & Encoding */}
      <div className="flex items-center gap-1">
        {currentSessionId && (
          <div className="flex items-center rounded bg-[#1e1e2d] border border-[#2a2b38] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('terminal')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-xs transition-colors ${
                viewMode === 'terminal'
                  ? 'bg-[#2a2b38] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-2.5 w-2.5" />
              <span>Terminal</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#2a2b38] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="h-2.5 w-2.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sftp')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-xs transition-colors ${
                viewMode === 'sftp'
                  ? 'bg-[#2a2b38] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="h-2.5 w-2.5" />
              <span>SFTP</span>
            </button>
          </div>
        )}

        <span className="ml-2 font-mono text-[10px] text-slate-500">UTF-8</span>
      </div>
    </footer>
  );
};
