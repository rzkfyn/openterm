import React, { useState, useEffect } from 'react';
import { ShieldCheck, Fingerprint, Smartphone, X, AlertCircle, ArrowRight, Check, Copy, KeyRound } from 'lucide-react';
import { useBiometricStore } from '../../stores/biometricStore';
import { tauriApi } from '../../services/tauri';
import { getBiometricName, isMac } from '../../utils/platform';

interface SecurityOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSetupTotp: () => void;
  onConnectTransient?: () => void;
  canConnectTransient: boolean;
}

export const SecurityOnboardingModal: React.FC<SecurityOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSetupTotp,
  onConnectTransient,
  canConnectTransient,
}) => {
  const { isAvailable, checkAvailability, authenticate, setEnabled } = useBiometricStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkAvailability();
      setError(null);
      setBackupCodes(null);
      setCopied(false);
    }
  }, [isOpen, checkAvailability]);

  if (!isOpen) return null;

  const handleEnableBiometric = async () => {
    const bioName = getBiometricName();
    if (!isAvailable) {
      setError(
        `Biometric authentication not configured in OS. Set up ${bioName} in System Settings.`
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const verified = await authenticate(`Enable ${bioName} / Passkey for OpenTerm`);
      if (verified) {
        setEnabled(true);
        // Generate emergency recovery codes for TPM / BIOS reset safety
        try {
          const codes = await tauriApi.totpGenerateEmergencyRecoveryCodes();
          if (codes && codes.length > 0) {
            setBackupCodes(codes);
            return;
          }
        } catch {
          // If code generation fails, still succeed biometric setup
        }
        onSuccess();
      } else {
        setError('Biometric verification cancelled or failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric setup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-[#181824] border border-[#2e2f42] p-6 shadow-2xl space-y-5">
        {/* Step 2: Emergency Recovery Codes after Windows Hello enabled */}
        {backupCodes ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Emergency Recovery Codes
                  </h3>
                  <p className="text-[11px] text-emerald-400">{getBiometricName()} active</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Save these 8 one-time emergency recovery codes. If your system credentials or TPM reset ever clears {getBiometricName()}, enter any code on the lock screen to regain access:
            </p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded bg-[#11111a] border border-[#2e2f42] font-mono text-xs text-slate-200">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="text-center py-1 bg-[#181824] rounded border border-[#222332]">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleCopyCodes}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#252636] hover:bg-[#2e3046] text-slate-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy All Codes'}</span>
              </button>
              <button
                type="button"
                onClick={onSuccess}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Selection View */
          <>
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Setup App Protection
                  </h3>
                  <p className="text-[11px] text-slate-400">Required before saving credentials to disk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              OpenTerm requires at least one protection method enabled to securely store passwords and keys on your computer. Choose how you want to unlock:
            </p>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded border border-rose-800/40">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Option A: Biometrics (Windows Hello / Passkey) */}
              <button
                type="button"
                onClick={handleEnableBiometric}
                disabled={isLoading}
                className={`w-full p-3 rounded-lg text-left transition-all cursor-pointer group flex items-start gap-3 ${
                  isAvailable
                    ? 'bg-gradient-to-r from-emerald-950/40 to-[#181824] border border-emerald-700/50 hover:border-emerald-500'
                    : 'bg-[#14151f] border border-[#2e2f42] hover:border-slate-500 opacity-85'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 group-hover:scale-105 transition-transform ${
                    isAvailable
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40'
                  }`}
                >
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isAvailable ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {getBiometricName()} / Passkey
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isAvailable
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >
                      {isAvailable ? 'Fastest' : 'Requires OS Setup'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAvailable
                      ? isMac
                        ? 'Unlock instantly using Touch ID or system passphrase.'
                        : 'Unlock instantly using Windows Hello PIN, facial recognition, or fingerprint.'
                      : `Not configured. Set up ${getBiometricName()} in System Settings.`}
                  </p>
                </div>
              </button>

              {/* Option B: TOTP Authenticator */}
              <button
                type="button"
                onClick={onSetupTotp}
                disabled={isLoading}
                className="w-full p-3 rounded-lg bg-[#141420] border border-[#2e2f42] hover:border-indigo-500/50 text-left transition-all cursor-pointer group flex items-start gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      2FA Authenticator App
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scan QR code with Google Authenticator, Aegis, or 1Password.
                  </p>
                </div>
              </button>
            </div>

            {/* Transient connection option */}
            {canConnectTransient && onConnectTransient && (
              <div className="pt-2 border-t border-[#2e2f42] flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Just doing a quick test?</span>
                <button
                  type="button"
                  onClick={onConnectTransient}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>Connect without saving</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
