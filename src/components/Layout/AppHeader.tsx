import React, { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { Terminal, FolderTree, Columns, Plus, X, Server, RotateCw, XCircle } from 'lucide-react';
import { SessionConfig } from '../../types';

interface AppHeaderProps {
  onOpenNewConnection: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNewConnection }) => {
  const {
    activeSessions,
    currentSessionId,
    setCurrentSessionId,
    disconnectSession,
    disconnectOtherSessions,
    disconnectAllSessions,
    connectSession,
    reconnectSession,
    viewMode,
    setViewMode,
  } = useSessionStore();

  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    session: SessionConfig;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex h-[38px] items-center justify-between px-3 bg-[#11111a] border-b border-[#2a2b38] select-none shrink-0 z-30">
      {/* Left: Brand + Tabs */}
      <div className="flex items-center h-full gap-2 overflow-x-auto no-scrollbar">
        {/* Logo / Brand -> Click to open Dashboard */}
        <button
          type="button"
          onClick={() => setCurrentSessionId(null)}
          className={`flex items-center gap-2 px-2 py-1 -ml-1 rounded-md transition-colors cursor-pointer border ${
            currentSessionId === null
              ? 'bg-[#1e1e2d] border-[#2a2b38] text-white shadow-xs'
              : 'border-transparent text-slate-300 hover:text-white hover:bg-[#1e1e2d]/60'
          }`}
          title="Go to Dashboard"
        >
          <img src="/app-icon.png" alt="OpenTerm" className="h-4 w-4 rounded-xs shrink-0" />
          <span className="text-xs font-semibold tracking-tight">OpenTerm</span>
        </button>

        <div className="h-3.5 w-px bg-[#2a2b38] mx-0.5" />

        {/* Sessions Tab Bar */}
        <div className="flex items-center h-full gap-1 pt-1">
          {activeSessions.map((session) => {
            const isActive = session.id === currentSessionId;
            const isDead = session.status === 'disconnected';
            const isReconnecting = session.status === 'reconnecting';
            return (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id || null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    session,
                  });
                }}
                className={`group relative flex items-center gap-2 px-3 h-[30px] rounded-t-md text-xs transition-colors cursor-pointer border-t border-x ${
                  isActive
                    ? 'bg-[#1e1e2d] text-white border-[#2a2b38] border-t-indigo-400 font-medium'
                    : 'bg-[#11111a] text-slate-400 border-transparent hover:bg-[#181824] hover:text-slate-200'
                }`}
                title={
                  isDead
                    ? 'Session disconnected'
                    : isReconnecting
                    ? 'Auto-reconnecting...'
                    : `${session.username}@${session.host}:${session.port}`
                }
              >
                {/* Status Dot */}
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isDead
                      ? 'bg-rose-500'
                      : isReconnecting
                      ? 'bg-amber-400 animate-ping'
                      : session.status === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <Server className={`h-3 w-3 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className={`truncate max-w-[140px] font-mono text-[11px] ${isDead ? 'line-through text-slate-500' : ''}`}>
                  {session.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (session.id) disconnectSession(session.id);
                  }}
                  className="rounded p-0.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onOpenNewConnection}
            className="flex items-center justify-center h-[28px] px-2 rounded-md text-slate-400 hover:text-white hover:bg-[#1e1e2d] transition-colors"
            title="New Connection"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Right: View toggles (only when connected to a session) */}
      {currentSessionId && (
        <div className="flex items-center gap-1">
          <div className="flex items-center p-0.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38]">
            <button
              type="button"
              onClick={() => setViewMode('terminal')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'terminal'
                  ? 'bg-[#2a2b38] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Terminal"
            >
              <Terminal className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#2a2b38] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Split (Terminal + SFTP)"
            >
              <Columns className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sftp')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'sftp'
                  ? 'bg-[#2a2b38] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="SFTP Explorer"
            >
              <FolderTree className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          ref={menuRef}
          style={{ top: tabContextMenu.y + 4, left: tabContextMenu.x }}
          className="fixed z-50 min-w-[150px] rounded-md bg-[#181824] border border-[#2e2f42] p-1 shadow-2xl text-xs text-slate-300 font-sans select-none animate-in fade-in zoom-in-95 duration-75"
        >
          {(tabContextMenu.session.status === 'disconnected' ||
            tabContextMenu.session.status === 'reconnecting') && (
            <button
              type="button"
              onClick={async () => {
                const s = tabContextMenu.session;
                setTabContextMenu(null);
                try {
                  if (s.id) {
                    await reconnectSession(s.id);
                  } else {
                    await connectSession(s);
                  }
                } catch {
                  // error shown in session store
                }
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <RotateCw className="h-3.5 w-3.5 text-emerald-400" />
              <span>Reconnect</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const id = tabContextMenu.session.id;
              setTabContextMenu(null);
              if (id) disconnectSession(id);
            }}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close Tab</span>
          </button>

          {activeSessions.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const id = tabContextMenu.session.id;
                setTabContextMenu(null);
                if (id) disconnectOtherSessions(id);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-left"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Close Other Tabs</span>
            </button>
          )}

          <div className="my-1 border-t border-[#252636]" />

          <button
            type="button"
            onClick={() => {
              setTabContextMenu(null);
              disconnectAllSessions();
            }}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-rose-600 hover:text-white text-rose-300 transition-colors cursor-pointer text-left"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Close All Tabs</span>
          </button>
        </div>
      )}
    </header>
  );
};
