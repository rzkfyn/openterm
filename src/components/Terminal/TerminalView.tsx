import React, { useState, useEffect } from 'react';
import { useTerminalSession } from './useTerminalSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { TerminalContextMenu, TerminalContextMenuPosition } from './TerminalContextMenu';
import { QuickCommandsDropdown } from './QuickCommandsDropdown';
import { TerminalSearchBar } from './TerminalSearchBar';
import { Terminal as TerminalIcon, AlertCircle, RotateCw, Search } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string | null;
  sessionName?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, sessionName }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);

  const handleOpenSearch = () => {
    const sel = getSelection();
    setSearchInitialQuery(sel);
    setIsSearchOpen(true);
    setSearchNonce((n) => n + 1);
  };

  const {
    containerRef,
    terminal,
    copySelection,
    pasteFromClipboard,
    selectAll,
    clearTerminal,
    resetTerminal,
    findNext,
    findPrevious,
    clearSearch,
    searchResult,
    getSelection,
  } = useTerminalSession(sessionId, handleOpenSearch);
  const [contextMenu, setContextMenu] = useState<TerminalContextMenuPosition | null>(null);
  const activeSessions = useSessionStore((s) => s.activeSessions);
  const reconnectSession = useSessionStore((s) => s.reconnectSession);
  const currentTheme = useThemeStore((s) => s.theme);
  const currentSession = activeSessions.find((s) => s.id === sessionId);
  const isDisconnected = currentSession?.status === 'disconnected';
  const isReconnecting = currentSession?.status === 'reconnecting';

  // Handle Cmd/Ctrl + '+' / '-' / '0' zoom shortcuts and Cmd/Ctrl + F search shortcut
  useEffect(() => {
    const handleTerminalShortcuts = (e: KeyboardEvent) => {
      if (!sessionId) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;
      if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        useSettingsStore.getState().increaseTerminalFontSize();
      } else if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        useSettingsStore.getState().decreaseTerminalFontSize();
      } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        useSettingsStore.getState().resetTerminalFontSize();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleOpenSearch();
      }
    };
    window.addEventListener('keydown', handleTerminalShortcuts);
    return () => window.removeEventListener('keydown', handleTerminalShortcuts);
  }, [sessionId]);

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
      <div className="flex h-[30px] items-center justify-between border-b border-[#2a2b38] bg-[#11111a] px-3.5 text-xs select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-white">
            {sessionName || 'terminal'}
          </span>
          <span className="text-[10.5px] font-mono text-slate-300 px-1.5 py-0.5 rounded bg-[#1e1e2d] border border-[#2a2b38]">
            #{sessionId.slice(0, 8)}
          </span>
          <QuickCommandsDropdown
            sessionId={sessionId}
            hostName={sessionName}
            customCommands={currentSession?.quickCommands}
            onCommandExecuted={() => terminal?.focus()}
          />
          <button
            type="button"
            onClick={handleOpenSearch}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-sans font-medium transition-colors cursor-pointer border bg-[#1e1e2d] text-slate-300 border-[#2a2b38] hover:text-white hover:border-slate-500"
            title="Find in terminal (Cmd+F)"
          >
            <Search className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Find</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] font-mono">
          {isDisconnected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Disconnected</span>
              </span>
              <button
                type="button"
                onClick={() => sessionId && reconnectSession(sessionId)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
                title="Reconnect now"
              >
                <RotateCw className="h-3 w-3" />
                <span>Reconnect</span>
              </button>
            </div>
          ) : isReconnecting ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-amber-400 font-medium animate-pulse">
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                <span>Auto-reconnecting...</span>
              </span>
              <button
                type="button"
                onClick={() => sessionId && reconnectSession(sessionId)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-sans text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
                title="Retry now"
              >
                <span>Retry Now</span>
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Live PTY</span>
            </span>
          )}
          <span className="text-slate-600">·</span>
          <span className="text-slate-300">xterm-256color</span>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div
          className="h-full w-full overflow-hidden cursor-text p-1"
          style={{ backgroundColor: currentTheme.xterm.background }}
          ref={containerRef}
          onClick={() => terminal?.focus()}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        />

        {/* Floating Search Bar Overlay */}
        <TerminalSearchBar
          isOpen={isSearchOpen}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchInitialQuery('');
            clearSearch();
            terminal?.focus();
          }}
          onFindNext={findNext}
          onFindPrevious={findPrevious}
          onClear={clearSearch}
          resultInfo={searchResult}
          initialQuery={searchInitialQuery}
          searchNonce={searchNonce}
        />
      </div>

      {contextMenu && (
        <TerminalContextMenu
          position={contextMenu}
          hasSelection={Boolean(terminal?.hasSelection())}
          onCopy={() => {
            copySelection();
            terminal?.focus();
          }}
          onPaste={() => {
            pasteFromClipboard();
            terminal?.focus();
          }}
          onSelectAll={() => {
            selectAll();
            terminal?.focus();
          }}
          onFind={() => {
            handleOpenSearch();
          }}
          onClear={() => {
            clearTerminal();
            terminal?.focus();
          }}
          onReset={() => {
            resetTerminal();
            terminal?.focus();
          }}
          onClose={() => {
            setContextMenu(null);
            terminal?.focus();
          }}
        />
      )}
    </div>
  );
};
