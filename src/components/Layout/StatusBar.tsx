import React from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useUpdateStore } from '../../stores/updateStore';
import { tauriApi } from '../../services/tauri';
import { Terminal, Columns, FolderTree, Wifi, WifiOff, ArrowUpCircle, X, Palette } from 'lucide-react';
import { useThemeStore, THEME_PRESETS } from '../../stores/themeStore';

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
  const { currentSessionId, activeSessions, viewMode, setViewMode } = useSessionStore();
  const { currentThemeId, setTheme } = useThemeStore();
  const {
    currentVersion,
    latestVersion,
    releaseUrl,
    hasUpdate,
    isChecking,
    dismissed,
    checkStatus,
    dismissUpdate,
    checkForUpdates,
  } = useUpdateStore();
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
            onClick={() => checkForUpdates(true)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleOpenReleases();
            }}
            className={`flex items-center gap-1 font-mono text-[10px] transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-[#1e1e2d] ${
              isChecking
                ? 'text-indigo-400 animate-pulse'
                : checkStatus === 'up-to-date'
                ? 'text-emerald-400 font-medium'
                : checkStatus === 'error'
                ? 'text-rose-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={
              isChecking
                ? 'Checking for updates...'
                : checkStatus === 'up-to-date'
                ? 'OpenTerm is up to date!'
                : checkStatus === 'error'
                ? 'Failed to check updates (click to retry)'
                : 'v' + currentVersion + ' (Click to check updates, right-click for release history)'
            }
          >
            <span>v{currentVersion}</span>
            {checkStatus === 'up-to-date' && <span className="text-[9px] text-emerald-400">✓ Up to date</span>}
            {checkStatus === 'error' && <span className="text-[9px] text-rose-400">✗ Check failed</span>}
          </button>
        </div>

        {hasUpdate && !dismissed && latestVersion && (
          <div className="inline-flex items-center rounded bg-[#1e1e2d] border border-[#2a2b38] hover:border-indigo-500/40 divide-x divide-[#2a2b38] text-[10px] overflow-hidden transition-colors">
            <button
              type="button"
              onClick={handleOpenLatestRelease}
              className="flex items-center gap-1.5 px-2 py-0.5 text-slate-300 hover:text-white hover:bg-[#25263a] transition-colors cursor-pointer"
              title={`New version v${latestVersion} available! Click to view release notes.`}
            >
              <ArrowUpCircle className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="text-slate-400">Update</span>
              <span className="font-mono text-indigo-300 font-medium">v{latestVersion}</span>
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              className="px-1.5 py-0.5 text-slate-500 hover:text-slate-300 hover:bg-[#25263a] transition-colors cursor-pointer flex items-center justify-center"
              title="Dismiss update notification"
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

        {/* Color Theme Picker */}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#2a2b38]">
          <Palette className="h-3 w-3 text-slate-400 shrink-0" />
          <select
            value={currentThemeId}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-transparent text-[10px] text-slate-400 hover:text-slate-200 border-none outline-none cursor-pointer pr-1"
            title="Color theme preset"
          >
            {THEME_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-[#181824] text-slate-200">
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </footer>
  );
};
