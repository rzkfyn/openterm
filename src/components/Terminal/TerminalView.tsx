import React from 'react';
import { useTerminalSession } from './useTerminalSession';
import { Terminal as TerminalIcon, Sparkles, Activity } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string | null;
  sessionName?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, sessionName }) => {
  const { containerRef } = useTerminalSession(sessionId);

  if (!sessionId) {
    return (
      <div className="flex h-full w-full p-2">
        {/* Double-Bezel Hardware Enclosure */}
        <div className="flex flex-1 flex-col items-center justify-center p-2 rounded-[2rem] bg-white/[0.02] border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <div className="flex flex-col items-center justify-center w-full h-full rounded-[calc(2rem-0.5rem)] bg-[#050811]/90 border border-white/[0.04] p-8 text-center relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute inset-0 pointer-events-none bg-radial from-sky-500/5 to-transparent blur-3xl" />
            
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] mb-4">
              <TerminalIcon className="h-8 w-8 stroke-[1.2] text-slate-400" />
            </div>

            <span className="relative z-10 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] font-mono font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] mb-3">
              Direct PTY Stream
            </span>

            <h3 className="relative z-10 text-base font-medium tracking-tight text-white mb-1">
              No Active Terminal Session
            </h3>
            <p className="relative z-10 text-xs text-slate-500 max-w-xs leading-relaxed">
              Connect to an SSH server to initialize an isolated, hardware-accelerated xterm shell.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full p-1.5">
      {/* Outer Shell (Double-Bezel) */}
      <div className="flex flex-1 flex-col p-1 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Inner Core */}
        <div className="flex flex-1 flex-col rounded-[calc(1.5rem-0.25rem)] bg-[#050811] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden">
          {/* Hardware Header Bar */}
          <div className="flex h-8 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 text-xs select-none">
            <div className="flex items-center space-x-2.5">
              <div className="flex space-x-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80 border border-rose-400/40" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80 border border-amber-400/40" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 border border-emerald-400/40" />
              </div>
              <div className="h-3 w-[1px] bg-white/[0.08] mx-1" />
              <span className="font-mono text-[11px] font-medium text-slate-300 tracking-tight">
                {sessionName || 'Terminal'}
              </span>
              <span className="text-[10px] font-mono text-slate-600">
                #{sessionId.slice(0, 8)}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500">
              <span className="flex items-center space-x-1">
                <Activity className="h-3 w-3 text-emerald-400" />
                <span>Raw I/O Byte Stream</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/[0.06]">
                xterm-256color
              </span>
            </div>
          </div>

          {/* Terminal Viewport */}
          <div className="relative flex-1 w-full p-2 overflow-hidden bg-[#03060e]" ref={containerRef} />
        </div>
      </div>
    </div>
  );
};
