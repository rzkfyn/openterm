import React from 'react';
import { useTerminalSession } from './useTerminalSession';
import { Terminal as TerminalIcon, Maximize2 } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string | null;
  sessionName?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, sessionName }) => {
  const { containerRef } = useTerminalSession(sessionId);

  if (!sessionId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 text-slate-500">
        <TerminalIcon className="mb-2 h-10 w-10 stroke-1 text-slate-600" />
        <p className="text-sm">No active terminal session</p>
        <p className="text-xs text-slate-600 mt-1">Connect or select a host to start</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#090d16] overflow-hidden border border-slate-800/80 rounded-sm">
      {/* Subheader Toolbar */}
      <div className="flex h-7 items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-3 text-xs text-slate-400 select-none">
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span className="font-mono text-slate-300">{sessionName || 'Terminal'}</span>
          <span className="text-[10px] text-slate-500 font-mono">({sessionId.slice(0, 8)})</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-500">xterm-256color</span>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="relative flex-1 w-full p-1 overflow-hidden" ref={containerRef} />
    </div>
  );
};
