import React, { useState } from 'react';
import { SessionConfig, AuthType } from '../../types';
import { X, Server, Key, Lock } from 'lucide-react';

interface NewConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: SessionConfig) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const NewConnectionModal: React.FC<NewConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isLoading,
  error,
}) => {
  const [name, setName] = useState('My Server');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !username) return;

    await onConnect({
      name: name || host,
      host,
      port: Number(port) || 22,
      username,
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
      passphrase: authType === 'key' && passphrase ? passphrase : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">New SSH / SFTP Session</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs text-slate-300">
          {error && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Web"
              className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block mb-1 text-[11px] font-medium text-slate-400">Host / IP *</label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1 or example.com"
                className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-400">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">Username *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">Authentication</label>
            <div className="flex rounded border border-slate-800 p-0.5 bg-slate-950">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1 rounded flex items-center justify-center space-x-1.5 ${
                  authType === 'password'
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="h-3 w-3" />
                <span>Password</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-1 rounded flex items-center justify-center space-x-1.5 ${
                  authType === 'key'
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="h-3 w-3" />
                <span>Private Key</span>
              </button>
            </div>
          </div>

          {authType === 'password' ? (
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-400">
                  Private Key Absolute Path
                </label>
                <input
                  type="text"
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                  placeholder="/Users/username/.ssh/id_ed25519"
                  className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-400">
                  Passphrase (Optional)
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
