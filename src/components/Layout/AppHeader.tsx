import React from 'react';
import { ViewMode } from '../../types';
import { useSessionStore } from '../../stores/sessionStore';
import {
  Terminal,
  FolderTree,
  Columns,
  Plus,
  X,
  Radio,
} from 'lucide-react';

interface AppHeaderProps {
  onOpenNewConnection: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNewConnection }) => {
  const {
    activeSessions,
    currentSessionId,
    setCurrentSessionId,
    disconnectSession,
    viewMode,
    setViewMode,
  } = useSessionStore();

  return (
    <header className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 text-xs select-none shrink-0">
      {/* Brand & Active Session Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-1.5 pr-2 border-r border-slate-800">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-600 font-bold text-[11px] text-white">
            OT
          </div>
          <span className="font-semibold text-slate-100 hidden sm:inline">OpenTerm</span>
        </div>

        {/* Sessions Tab Bar */}
        <div className="flex items-center space-x-1">
          {activeSessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id || null)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-sky-300 font-medium'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Radio className={`h-2.5 w-2.5 ${isActive ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'}`} />
                <span className="truncate max-w-[100px]">{session.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (session.id) disconnectSession(session.id);
                  }}
                  className="rounded p-0.5 text-slate-500 hover:text-rose-400 hover:bg-slate-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            onClick={onOpenNewConnection}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Open new connection"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden md:inline">Connect</span>
          </button>
        </div>
      </div>

      {/* View Mode Toggle Controls */}
      <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
        <button
          onClick={() => setViewMode('terminal')}
          className={`px-2 py-1 rounded flex items-center space-x-1 text-[11px] ${
            viewMode === 'terminal'
              ? 'bg-sky-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Terminal Full View"
        >
          <Terminal className="h-3 w-3" />
          <span className="hidden lg:inline">Terminal</span>
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-2 py-1 rounded flex items-center space-x-1 text-[11px] ${
            viewMode === 'split'
              ? 'bg-sky-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Dual Split View (Terminal + SFTP)"
        >
          <Columns className="h-3 w-3" />
          <span className="hidden lg:inline">Split</span>
        </button>
        <button
          onClick={() => setViewMode('sftp')}
          className={`px-2 py-1 rounded flex items-center space-x-1 text-[11px] ${
            viewMode === 'sftp'
              ? 'bg-sky-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="SFTP File Manager Full View"
        >
          <FolderTree className="h-3 w-3" />
          <span className="hidden lg:inline">SFTP</span>
        </button>
      </div>
    </header>
  );
};
