import React, { useState } from 'react';
import { useTerminalSession } from './useTerminalSession';
import { useSessionStore } from '../../stores/sessionStore';
import { TerminalContextMenu, TerminalContextMenuPosition } from './TerminalContextMenu';
import { Terminal as TerminalIcon, Radio, AlertCircle, RotateCw } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string | null;
  sessionName?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, sessionName }) => {
  const {
    containerRef,
    terminal,
    copySelection,
    pasteFromClipboard,
    selectAll,
    clearTerminal,
    resetTerminal,
  } = useTerminalSession(sessionId);
  const [contextMenu, setContextMenu] = useState<TerminalContextMenuPosition | null>(null);
  const activeSessions = useSessionStore((s) => s.activeSessions);
  const reconnectSession = useSessionStore((s) => s.reconnectSession);
  const currentSession = activeSessions.find((s) => s.id === sessionId);
  const isDisconnected = currentSession?.status === 'disconnected';
  const isReconnecting = currentSession?.status === 'reconnecting';

  if (!sessionId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 bg-[#1e1e2d]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#11111a] border border-[#2a2b38]">
            <TerminalIcon className="h-5 w-5 text-indigo-400" />
          </div>
          <h3 className="text-xs font-medium text-slate-200 mb-0.5">
            No Active Terminal Session
          </h3>
          <p className="text-[11px] text-slate-400 max-w-xs">
            Connect to an SSH host to open an interactive PTY shell.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-[#1e1e2d] overflow-hidden">
      {/* Subheader bar */}
      <div className="flex h-[28px] items-center justify-between border-b border-[#2a2b38] bg-[#11111a] px-3.5 text-xs select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-slate-200">
            {sessionName || 'terminal'}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            #{sessionId.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          {isDisconnected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-rose-400">
                <AlertCircle className="h-3 w-3" />
                <span>Disconnected</span>
              </span>
              <button
                type="button"
                onClick={() => sessionId && reconnectSession(sessionId)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-sans text-[10px] transition-colors cursor-pointer"
                title="Reconnect now"
              >
                <RotateCw className="h-2.5 w-2.5" />
                <span>Reconnect</span>
              </button>
            </div>
          ) : isReconnecting ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-amber-400 animate-pulse">
                <RotateCw className="h-3 w-3 animate-spin" />
                <span>Auto-reconnecting...</span>
              </span>
              <button
                type="button"
                onClick={() => sessionId && reconnectSession(sessionId)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-600/80 hover:bg-amber-600 text-white font-sans text-[10px] transition-colors cursor-pointer"
                title="Retry now"
              >
                <span>Retry Now</span>
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <Radio className="h-2.5 w-2.5" />
              <span>Live PTY</span>
            </span>
          )}
          <span className="text-slate-500">xterm-256color</span>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#13131d] cursor-text p-1"
        ref={containerRef}
        onClick={() => terminal?.focus()}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      />

      {contextMenu && (
        <TerminalContextMenu
          position={contextMenu}
          hasSelection={Boolean(terminal?.hasSelection())}
          onCopy={copySelection}
          onPaste={pasteFromClipboard}
          onSelectAll={selectAll}
          onClear={clearTerminal}
          onReset={resetTerminal}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
