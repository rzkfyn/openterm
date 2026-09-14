import React, { useState, useEffect } from 'react';
import { ShieldCheck, Fingerprint, Smartphone, X, AlertCircle, ArrowRight } from 'lucide-react';
import { useBiometricStore } from '../../stores/biometricStore';

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

  useEffect(() => {
    if (isOpen) {
      checkAvailability();
      setError(null);
    }
  }, [isOpen, checkAvailability]);

  if (!isOpen) return null;

  const handleEnableBiometric = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const verified = await authenticate('Enable Windows Hello / Passkey for OpenTerm');
      if (verified) {
        setEnabled(true);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-[#181824] border border-[#2e2f42] p-6 shadow-2xl space-y-5">
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
          {isAvailable && (
            <button
              type="button"
              onClick={handleEnableBiometric}
              disabled={isLoading}
              className="w-full p-3 rounded-lg bg-gradient-to-r from-emerald-950/40 to-[#181824] border border-emerald-700/50 hover:border-emerald-500 text-left transition-all cursor-pointer group flex items-start gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300">
                    Windows Hello / Passkey
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                    Fastest
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Unlock instantly using fingerprint, face, or device PIN.
                </p>
              </div>
            </button>
          )}

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
      </div>
    </div>
  );
};
