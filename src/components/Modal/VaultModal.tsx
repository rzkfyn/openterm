import React, { useState } from 'react';
import { Shield, Lock, Unlock, X, KeyRound, AlertCircle, Check } from 'lucide-react';
import { tauriApi } from '../../services/tauri';
import { VaultStatus } from '../../types';

interface VaultModalProps {
  isOpen: boolean;
  status: VaultStatus;
  onClose: () => void;
  onStatusChange: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  status,
  onClose,
  onStatusChange,
}) => {
  const [mode, setMode] = useState<'unlock' | 'setup' | 'change' | 'remove'>(
    !status.isEncrypted ? 'setup' : !status.isUnlocked ? 'unlock' : 'change'
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return;

    setIsLoading(true);
    setError(null);
    try {
      await tauriApi.vaultUnlock(currentPassword);
      setCurrentPassword('');
      onStatusChange();
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupOrChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setError('Master password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (status.isEncrypted && !currentPassword) {
      setError('Current master password is required.');
      return;
    }

    setIsLoading(true);
    try {
      await tauriApi.vaultSetPassword(
        newPassword,
        status.isEncrypted ? currentPassword : undefined
      );
      setSuccessMessage('Vault password saved successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onStatusChange();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError('Current master password is required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await tauriApi.vaultRemovePassword(currentPassword);
      setSuccessMessage('Vault decrypted. Master password removed.');
      setCurrentPassword('');
      onStatusChange();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="w-full max-w-md rounded-lg bg-[#181824] border border-[#2e2f42] p-5 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Master Password Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status banner */}
        <div className="mt-3.5 flex items-center gap-2 p-2.5 rounded bg-[#11111a] border border-[#262738] text-xs">
          {status.isEncrypted ? (
            status.isUnlocked ? (
              <>
                <Unlock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Vault status: <strong className="text-emerald-400 font-semibold">Unlocked (AES-256-GCM)</strong></span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-300">Vault status: <strong className="text-amber-400 font-semibold">Locked</strong></span>
              </>
            )
          ) : (
            <>
              <KeyRound className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400">Vault status: <strong className="text-slate-300">Unencrypted (Plaintext)</strong></span>
            </>
          )}
        </div>

        {/* Navigation tabs if unlocked or unencrypted */}
        {status.isEncrypted && status.isUnlocked && (
          <div className="flex gap-2 mt-3 text-xs border-b border-[#252636] pb-2">
            <button
              type="button"
              onClick={() => { setMode('change'); setError(null); }}
              className={`px-2.5 py-1 rounded transition-colors ${mode === 'change' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('remove'); setError(null); }}
              className={`px-2.5 py-1 rounded transition-colors ${mode === 'remove' ? 'bg-rose-600/80 text-white font-medium' : 'text-slate-400 hover:text-rose-300'}`}
            >
              Disable Vault
            </button>
          </div>
        )}

        {/* Form Body */}
        {mode === 'unlock' && (
          <form onSubmit={handleUnlock} className="mt-4 space-y-3">
            <p className="text-xs text-slate-300">
              Enter your master password to decrypt saved SSH profiles and credentials.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Master Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                placeholder="••••••••"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !currentPassword}
                className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Decrypting...' : 'Unlock Vault'}
              </button>
            </div>
          </form>
        )}

        {(mode === 'setup' || mode === 'change') && (
          <form onSubmit={handleSetupOrChange} className="mt-4 space-y-3">
            <p className="text-xs text-slate-300">
              {mode === 'setup'
                ? 'Protect all saved hosts, passwords, and private keys with a master password (PBKDF2-SHA256 + AES-256-GCM).'
                : 'Enter your existing master password and set a new one.'}
            </p>

            {status.isEncrypted && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Current Master Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                New Master Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !newPassword}
                className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Encrypting...' : mode === 'setup' ? 'Enable Vault' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {mode === 'remove' && (
          <form onSubmit={handleRemove} className="mt-4 space-y-3">
            <p className="text-xs text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-900/40">
              Warning: Disabling the vault will save your profiles in unencrypted plaintext on disk.
            </p>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Current Master Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !currentPassword}
                className="px-4 py-1.5 text-xs font-medium rounded bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Decrypting...' : 'Disable & Decrypt Vault'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
