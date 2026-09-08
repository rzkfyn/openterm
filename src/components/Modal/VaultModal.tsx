import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, X, KeyRound, AlertCircle, Check, Copy, LifeBuoy, Clock } from 'lucide-react';
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
  const [mode, setMode] = useState<
    'unlock' | 'setup' | 'change' | 'remove' | 'recover' | 'recovery_key_display'
  >(!status.isEncrypted ? 'setup' : !status.isUnlocked ? 'unlock' : 'change');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [recoverySavedConfirmed, setRecoverySavedConfirmed] = useState(false);
  const [hasCopiedKey, setHasCopiedKey] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  useEffect(() => {
    if (isOpen) {
      setMode(!status.isEncrypted ? 'setup' : !status.isUnlocked ? 'unlock' : 'change');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryKey('');
      setTotpCode('');
      setGeneratedRecoveryKey('');
      setRecoverySavedConfirmed(false);
      setHasCopiedKey(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, status.isEncrypted, status.isUnlocked]);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || lockoutRemaining > 0) return;

    setIsLoading(true);
    setError(null);
    try {
      await tauriApi.vaultUnlock(currentPassword);
      setCurrentPassword('');
      setFailedAttempts(0);
      setLockoutRemaining(0);
      onStatusChange();
      onClose();
    } catch (err: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setLockoutRemaining(30);
        setError('Too many failed attempts. Vault unlock locked for 30 seconds.');
      } else {
        setError(`${err?.message || String(err)} (${5 - attempts} attempts remaining before temporary lockout)`);
      }
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
      const recoveryKeyReturned = await tauriApi.vaultSetPassword(
        newPassword,
        status.isEncrypted ? currentPassword : undefined
      );
      setGeneratedRecoveryKey(recoveryKeyReturned);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('recovery_key_display');
      onStatusChange();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!recoveryKey.trim()) {
      setError('Emergency recovery key is required.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New master password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const newRecoveryKey = await tauriApi.vaultRecover(
        recoveryKey.trim(),
        newPassword,
        totpCode.trim() || undefined
      );
      setGeneratedRecoveryKey(newRecoveryKey);
      setRecoveryKey('');
      setTotpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setFailedAttempts(0);
      setLockoutRemaining(0);
      setMode('recovery_key_display');
      onStatusChange();
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
        {status.isEncrypted && status.isUnlocked && mode !== 'recovery_key_display' && (
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

            {lockoutRemaining > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded border border-amber-800/50">
                <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Temporary lockout active: wait <strong>{lockoutRemaining}s</strong> before trying again.</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Master Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                disabled={lockoutRemaining > 0}
                placeholder="••••••••"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('recover');
                  setError(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Forgot Password? Recover
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !currentPassword || lockoutRemaining > 0}
                  className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isLoading ? 'Decrypting...' : 'Unlock Vault'}
                </button>
              </div>
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

        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="mt-4 space-y-3">
            <div className="flex items-start gap-2 p-2 rounded bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300">
              <LifeBuoy className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Emergency Vault Recovery</p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Enter your emergency recovery key to regain access to your encrypted connection profiles and set a new master password.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Emergency Recovery Key
              </label>
              <input
                type="text"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                autoFocus
                placeholder="OT-XXXX-XXXX-XXXX-XXXX"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                2FA Authenticator Code (Optional / if 2FA is active)
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code or backup code"
                className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

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

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => { setMode('unlock'); setError(null); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Back to Unlock
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !recoveryKey.trim() || !newPassword}
                  className="px-4 py-1.5 text-xs font-medium rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isLoading ? 'Recovering...' : 'Recover Vault'}
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === 'recovery_key_display' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
              <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <p className="font-semibold text-white">Vault Encrypted Successfully!</p>
                <p className="text-[11px] text-emerald-200/90 mt-1">
                  Save your Emergency Recovery Key now. If you ever forget your master password, this key is the <strong>only way</strong> to recover your saved profiles.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#11111a] border border-[#2a2b38] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Emergency Recovery Key</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedRecoveryKey);
                    setHasCopiedKey(true);
                    setTimeout(() => setHasCopiedKey(false), 2000);
                  }}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {hasCopiedKey ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-sm tracking-wider text-amber-300 select-all p-2 rounded bg-[#0b0b12] border border-[#1e1e2d] text-center font-bold">
                {generatedRecoveryKey}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recoverySavedConfirmed}
                onChange={(e) => setRecoverySavedConfirmed(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              <span>I have copied and securely saved this recovery key.</span>
            </label>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!recoverySavedConfirmed}
                onClick={() => {
                  onStatusChange();
                  onClose();
                }}
                className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
