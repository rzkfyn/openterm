import React, { useState } from 'react';
import { SessionConfig, AuthType } from '../../types';
import { X, Server, Key, Lock, ArrowRight, Shield, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

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
  const [name, setName] = useState('Production Node');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
      {/* Outer Shell (Double-Bezel Architecture) */}
      <div className="w-full max-w-lg p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Inner Core Container */}
        <div className="rounded-[calc(2rem-0.375rem)] bg-[#050811] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <Server className="h-4 w-4 stroke-[1.5] text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-white">Initialize Session</h3>
                <p className="text-[11px] font-mono text-slate-500">SSH & SFTP Multi-Channel Profile</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <X className="h-4 w-4 stroke-[1.5]" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 font-mono text-xs leading-relaxed">
                {error}
              </div>
            )}

            <div>
              <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Profile Identifier</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. EU Cluster Master"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Host / IP Target *</label>
                <input
                  type="text"
                  required
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="10.0.0.1 or node.example.com"
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Remote Username *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Authentication Protocol</label>
              <div className="flex p-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setAuthType('password')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-2 text-xs transition-all duration-300 ${
                    authType === 'password'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 stroke-[1.5]" />
                  <span>Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('key')}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-2 text-xs transition-all duration-300 ${
                    authType === 'key'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Key className="h-3.5 w-3.5 stroke-[1.5]" />
                  <span>Private Key</span>
                </button>
              </div>
            </div>

            {authType === 'password' ? (
              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 text-[11px] font-medium text-slate-400">
                    Identity Key Path (Absolute)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={privateKeyPath}
                      onChange={(e) => setPrivateKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                      className="flex-1 min-w-0 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const selected = await open({
                          multiple: false,
                          directory: false,
                          title: 'Select Private Key',
                        });
                        if (selected) setPrivateKeyPath(selected);
                      }}
                      className="flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                      title="Browse"
                    >
                      <FolderOpen className="h-4 w-4 stroke-[1.5]" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-[11px] font-medium text-slate-400">
                    Passphrase (Optional)
                  </label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex items-center space-x-2.5 pl-4 pr-2 py-2 rounded-full bg-white text-slate-950 hover:bg-emerald-400 text-xs font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-40"
              >
                <span>{isLoading ? 'Establishing...' : 'Connect Session'}</span>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 group-hover:bg-black group-hover:text-white transition-colors">
                  <ArrowRight className="h-3 w-3 stroke-[2] transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
