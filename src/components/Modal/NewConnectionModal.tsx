import React, { useState, useEffect } from 'react';
import { SessionConfig, AuthType, SavedConnection } from '../../types';
import { X, Key, Lock, ArrowRight, Save, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export type ModalMode = 'new' | 'edit';

interface NewConnectionModalProps {
  isOpen: boolean;
  mode: ModalMode;
  editingConnection?: SavedConnection | null;
  onClose: () => void;
  onSave: (conn: SavedConnection) => Promise<void>;
  onSaveAndConnect: (conn: SavedConnection, config: SessionConfig) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const NewConnectionModal: React.FC<NewConnectionModalProps> = ({
  isOpen,
  mode,
  editingConnection,
  onClose,
  onSave,
  onSaveAndConnect,
  isLoading,
  error,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [savePassword, setSavePassword] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && editingConnection) {
      setName(editingConnection.name);
      setHost(editingConnection.host);
      setPort(editingConnection.port);
      setUsername(editingConnection.username);
      setAuthType(editingConnection.authType);
      setPrivateKeyPath(editingConnection.privateKeyPath || '');
      setPassword(editingConnection.password || '');
      setPassphrase(editingConnection.passphrase || '');
      setSavePassword(Boolean(editingConnection.password || editingConnection.passphrase));
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('root');
      setAuthType('password');
      setPassword('');
      setPrivateKeyPath('');
      setPassphrase('');
      setSavePassword(true);
    }
  }, [isOpen, mode, editingConnection]);

  if (!isOpen) return null;

  const connId = (mode === 'edit' && editingConnection?.id) || crypto.randomUUID();

  const buildSavedConnection = (): SavedConnection => ({
    id: connId,
    name: name || host,
    host,
    port: Number(port) || 22,
    username,
    authType,
    privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
    password: authType === 'password' && savePassword && password ? password : undefined,
    passphrase: authType === 'key' && savePassword && passphrase ? passphrase : undefined,
    createdAt: editingConnection?.createdAt || 0,
    updatedAt: 0,
  });

  const buildSessionConfig = (): SessionConfig => ({
    name: name || host,
    host,
    port: Number(port) || 22,
    username,
    authType,
    password: authType === 'password' ? password : undefined,
    privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
    passphrase: authType === 'key' && passphrase ? passphrase : undefined,
  });

  const handleSaveOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !username) return;
    await onSave(buildSavedConnection());
  };

  const handleSaveAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !username) return;
    await onSaveAndConnect(buildSavedConnection(), buildSessionConfig());
  };

  const inputCls =
    'w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md rounded-lg bg-[#1e1e2d] border border-[#2a2b38] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2b38] bg-[#11111a] px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-100">
              {mode === 'edit' ? 'Edit Connection Profile' : 'New Connection Profile'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1e1e2d] cursor-pointer transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveAndConnect} className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-md bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">
              Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Server"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block mb-1 text-[11px] font-medium text-slate-400">
                Host / IP Target *
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="10.0.0.1"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-400">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">
              Username *
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Auth toggle */}
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-400">
              Authentication Method
            </label>
            <div className="flex rounded-md bg-[#11111a] p-0.5 border border-[#2a2b38]">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1 rounded flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  authType === 'password'
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="h-3 w-3" />
                <span>Password</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-1 rounded flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  authType === 'key'
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
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
              <label className="block mb-1 text-[11px] font-medium text-slate-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Not stored on device"
                className={inputCls}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-400">
                  Key Path
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    className={`flex-1 min-w-0 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const selected = await open({
                        multiple: false,
                        directory: false,
                        title: 'Select Private Key',
                        filters: [
                          {
                            name: 'SSH Keys (*.ppk, *.pem, id_*, *)',
                            extensions: ['ppk', 'pem', 'key', '*'],
                          },
                        ],
                      });
                      if (selected) setPrivateKeyPath(selected);
                    }}
                    className="flex items-center justify-center rounded-md bg-[#11111a] hover:bg-[#2a2b38] border border-[#2a2b38] px-2.5 text-slate-300 hover:text-white cursor-pointer transition-colors"
                    title="Browse Files"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-400">
                  Passphrase (Optional)
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Not stored on device"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Remember credentials in Vault */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={savePassword}
                onChange={(e) => setSavePassword(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              <span>Remember password/passphrase in profile</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2a2b38]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-[#11111a] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={isLoading || !host || !username}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2a2b38] hover:bg-[#343547] text-xs font-medium text-slate-200 cursor-pointer transition-colors disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save</span>
            </button>
            <button
              type="submit"
              disabled={isLoading || !host || !username}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white cursor-pointer transition-colors shadow-sm disabled:opacity-40"
            >
              <span>{isLoading ? 'Connecting...' : 'Save & Connect'}</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
