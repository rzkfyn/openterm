import React, { useState } from 'react';
import { SavedConnection, SessionConfig } from '../../types';
import { X, ArrowRight, Lock, Key, Server } from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  connection: SavedConnection | null;
  onClose: () => void;
  onConnect: (config: SessionConfig) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  connection,
  onClose,
  onConnect,
  isLoading,
  error,
}) => {
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');

  React.useEffect(() => {
    if (connection) {
      setPassword(connection.password || '');
      setPassphrase(connection.passphrase || '');
    }
  }, [connection]);

  if (!isOpen || !connection) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authType: connection.authType,
      password: connection.authType === 'password' ? password : undefined,
      privateKeyPath: connection.authType === 'key' ? connection.privateKeyPath : undefined,
      passphrase: connection.authType === 'key' && passphrase ? passphrase : undefined,
      bookmarks: connection.bookmarks,
    });
  };

  const inputCls =
    'w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-sm rounded-lg bg-[#1e1e2d] border border-[#2a2b38] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2b38] bg-[#11111a] px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400 shrink-0">
              <Server className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-slate-100">
                {connection.name}
              </h3>
              <p className="truncate text-[10px] font-mono text-slate-400">
                {connection.username}@{connection.host}:{connection.port}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1e1e2d] cursor-pointer transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Credentials */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-md bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {connection.authType === 'password' ? (
            <div>
              <label className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-slate-400">
                <Lock className="h-3 w-3" />
                <span>Password</span>
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-slate-400">
                <Key className="h-3 w-3" />
                <span>Passphrase (Optional)</span>
              </label>
              <input
                type="password"
                autoFocus
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave blank if unencrypted"
                className={inputCls}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2a2b38]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-[#11111a] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white cursor-pointer transition-colors shadow-sm disabled:opacity-40"
            >
              <span>{isLoading ? 'Connecting...' : 'Connect'}</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
