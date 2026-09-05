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
  ArrowUpRight,
  ShieldCheck,
  Cpu,
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
    <header className="relative z-30 flex h-14 items-center justify-between px-4 bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.07] select-none shrink-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
      {/* Brand & Active Sessions */}
      <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-1">
        {/* Double-Bezel Logo Pill */}
        <div className="flex items-center p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-[calc(1rem-0.25rem)] bg-gradient-to-br from-slate-900 to-black border border-white/[0.05]">
            <div className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-xs font-semibold tracking-tight text-white">OpenTerm</span>
            <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 uppercase px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              v0.1
            </span>
          </div>
        </div>

        {/* Vertical Hairline Divider */}
        <div className="h-4 w-[1px] bg-white/[0.08]" />

        {/* Sessions Tab Bar */}
        <div className="flex items-center space-x-1.5">
          {activeSessions.map((session) => {
            const isActive = session.id === currentSessionId;
            const isDisconnected = session.status === 'disconnected';
            return (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id || null)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                  isActive
                    ? 'bg-white/[0.08] border border-white/[0.15] text-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.5)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
                }`}
                title={isDisconnected ? 'Session closed by remote host' : undefined}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    isDisconnected
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                      : isActive
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : 'bg-slate-600'
                  }`}
                />
                <span className={`truncate max-w-[120px] text-xs font-medium ${isDisconnected ? 'text-slate-500 line-through' : ''}`}>
                  {session.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (session.id) disconnectSession(session.id);
                  }}
                  className="rounded-full p-0.5 text-slate-500 hover:text-rose-400 hover:bg-white/[0.08] transition-colors"
                >
                  <X className="h-3 w-3 stroke-[1.5]" />
                </button>
              </div>
            );
          })}

          {/* Island Button-in-Button Connect Trigger */}
          <button
            onClick={onOpenNewConnection}
            className="group flex items-center space-x-2 pl-3.5 pr-1.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
          >
            <span className="text-xs font-medium tracking-tight">Connect Host</span>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 group-hover:bg-emerald-500 group-hover:text-black transition-all duration-300 group-hover:scale-105">
              <Plus className="h-3 w-3 stroke-[2] transition-transform group-hover:rotate-90" />
            </div>
          </button>
        </div>
      </div>

      {/* View Mode Toggle Island */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center p-1 rounded-full bg-white/[0.03] border border-white/[0.07]">
          <button
            onClick={() => setViewMode('terminal')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              viewMode === 'terminal'
                ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 stroke-[1.5]" />
            <span className="hidden md:inline">Terminal</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              viewMode === 'split'
                ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="h-3.5 w-3.5 stroke-[1.5]" />
            <span className="hidden md:inline">Split</span>
          </button>
          <button
            onClick={() => setViewMode('sftp')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              viewMode === 'sftp'
                ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5 stroke-[1.5]" />
            <span className="hidden md:inline">SFTP</span>
          </button>
        </div>
      </div>
    </header>
  );
};
