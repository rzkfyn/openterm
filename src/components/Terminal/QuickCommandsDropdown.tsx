import React, { useState, useRef, useEffect } from 'react';
import { Zap, Plus, Trash2, ChevronRight, X } from 'lucide-react';
import { QuickCommand } from '../../types';
import { tauriApi } from '../../services/tauri';
import { useSavedConnectionStore } from '../../stores/savedConnectionStore';

interface QuickCommandsDropdownProps {
  sessionId: string;
  hostName?: string;
  customCommands?: QuickCommand[];
  onCommandExecuted?: () => void;
}

const DEFAULT_COMMANDS: { label: string; command: string }[] = [
  { label: 'System Monitor', command: 'htop' },
  { label: 'Disk Usage', command: 'df -h' },
  { label: 'Memory Info', command: 'free -m' },
  { label: 'Docker Containers', command: 'docker ps' },
  { label: 'Listening Ports', command: 'ss -tulpn' },
  { label: 'Uptime & Load', command: 'uptime' },
];

export const QuickCommandsDropdown: React.FC<QuickCommandsDropdownProps> = ({
  sessionId,
  hostName,
  customCommands = [],
  onCommandExecuted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const { connections, save } = useSavedConnectionStore();

  // Find saved connection profile if it matches hostName/username
  const savedConn = connections.find(
    (c) => c.name === hostName || c.host === hostName
  );

  const activeCustomList = savedConn?.quickCommands || customCommands;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const executeCommand = (cmd: string) => {
    // Send command with carriage return to execute immediately
    tauriApi.sshWrite(sessionId, `${cmd}\r`).catch(() => {});
    setIsOpen(false);
    onCommandExecuted?.();
  };

  const handleAddCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newCommand.trim()) return;

    const newCmd: QuickCommand = {
      id: crypto.randomUUID(),
      label: newLabel.trim(),
      command: newCommand.trim(),
    };

    if (savedConn) {
      const updated = {
        ...savedConn,
        quickCommands: [...(savedConn.quickCommands || []), newCmd],
      };
      await save(updated);
    }

    setNewLabel('');
    setNewCommand('');
    setIsAdding(false);
  };

  const handleDeleteCommand = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!savedConn) return;
    const updated = {
      ...savedConn,
      quickCommands: (savedConn.quickCommands || []).filter((c) => c.id !== id),
    };
    await save(updated);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans transition-colors cursor-pointer ${
          isOpen
            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
            : 'text-slate-400 hover:text-amber-300 hover:bg-[#252636]'
        }`}
        title="Quick Commands"
      >
        <Zap className="h-3 w-3 text-amber-400" />
        <span>Commands</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-md bg-[#141420] border border-[#2a2b38] shadow-2xl z-50 overflow-hidden text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2b38] bg-[#11111a]">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
              <Zap className="h-3 w-3 text-amber-400" />
              Quick Commands
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
            >
              {isAdding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              <span>{isAdding ? 'Cancel' : 'Add'}</span>
            </button>
          </div>

          {isAdding && (
            <form onSubmit={handleAddCommand} className="p-2 border-b border-[#2a2b38] bg-[#181826] space-y-1.5">
              <input
                type="text"
                placeholder="Label (e.g. Restart Nginx)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-[#11111a] border border-[#2a2b38] rounded px-2 py-1 text-[11px] text-white outline-none focus:border-amber-500"
                autoFocus
              />
              <input
                type="text"
                placeholder="Command (e.g. systemctl restart nginx)"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className="w-full bg-[#11111a] border border-[#2a2b38] rounded px-2 py-1 text-[11px] text-amber-300 font-mono outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!newLabel.trim() || !newCommand.trim()}
                className="w-full py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-semibold text-[10px] transition-colors"
              >
                Save Snippet
              </button>
            </form>
          )}

          <div className="max-h-56 overflow-y-auto py-1">
            {/* Custom Commands */}
            {activeCustomList.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                  Host Commands
                </div>
                {activeCustomList.map((cmd) => (
                  <div
                    key={cmd.id}
                    onClick={() => executeCommand(cmd.command)}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-amber-500/15 cursor-pointer group transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-slate-200 group-hover:text-amber-300 text-[11px] truncate">
                        {cmd.label}
                      </div>
                      <div className="font-mono text-[9px] text-slate-500 group-hover:text-amber-200/70 truncate">
                        {cmd.command}
                      </div>
                    </div>
                    {savedConn && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCommand(cmd.id, e)}
                        className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Default Snippets */}
            <div>
              <div className="px-3 py-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                System Snippets
              </div>
              {DEFAULT_COMMANDS.map((cmd) => (
                <div
                  key={cmd.label}
                  onClick={() => executeCommand(cmd.command)}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-[#1e1e2d] cursor-pointer group transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-slate-300 group-hover:text-white text-[11px] truncate">
                      {cmd.label}
                    </div>
                    <div className="font-mono text-[9px] text-slate-500 group-hover:text-slate-400 truncate">
                      {cmd.command}
                    </div>
                  </div>
                  <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-slate-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
