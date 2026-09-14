import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle, Fingerprint } from 'lucide-react';
import { tauriApi } from '../../services/tauri';
import { useBiometricStore } from '../../stores/biometricStore';

interface AppLockOverlayProps {
  isOpen: boolean;
  onUnlock: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({ isOpen, onUnlock }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const { isAvailable, isEnabled, checkAvailability, authenticate } = useBiometricStore();

  useEffect(() => {
    if (isOpen) {
      checkAvailability();
    }
  }, [isOpen, checkAvailability]);

  // Prompt biometric on open if available and enabled
  useEffect(() => {
    let active = true;
    if (isOpen && isAvailable && isEnabled) {
      const timer = setTimeout(() => {
        setIsBiometricLoading(true);
        authenticate('Unlock OpenTerm')
          .then((verified) => {
            if (active && verified) {
              setCode('');
              setError(null);
              onUnlock();
            }
          })
          .catch(() => {})
          .finally(() => {
            if (active) setIsBiometricLoading(false);
          });
      }, 200);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
    return () => {
      active = false;
    };
  }, [isOpen, isAvailable, isEnabled, authenticate, onUnlock]);

  if (!isOpen) return null;

  const handleBiometricUnlock = async () => {
    setIsBiometricLoading(true);
    setError(null);
    try {
      const verified = await authenticate('Unlock OpenTerm');
      if (verified) {
        setCode('');
        setError(null);
        onUnlock();
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric verification failed');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const validateCode = async (inputCode: string, isAutoSubmit = false) => {
    const trimmed = inputCode.trim();
    if (!trimmed) return;

    if (!isAutoSubmit) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const valid = await tauriApi.totpValidateLogin(trimmed);
      if (valid) {
        setCode('');
        setError(null);
        onUnlock();
      } else if (!isAutoSubmit) {
        setError('Invalid authentication code or backup recovery code.');
      }
    } catch (err: any) {
      if (!isAutoSubmit) {
        setError(err?.message || 'Validation failed');
      }
    } finally {
      if (!isAutoSubmit) {
        setIsLoading(false);
      }
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateCode(code, false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCode(val);
    if (error) setError(null);

    const clean = val.replace(/[\s-]/g, '');
    if (clean.length === 6 && /^\d{6}$/.test(clean)) {
      validateCode(clean, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0e15]/95 backdrop-blur-md p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl bg-[#181824] border border-[#2e2f42] p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Lock className="h-7 w-7" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-white">OpenTerm Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAvailable && isEnabled
              ? 'Unlock with Windows Hello / Passkey or enter your 6-digit authenticator code.'
              : 'Enter your 6-digit authenticator code or an 8-character backup recovery code to unlock.'}
          </p>
        </div>

        {isAvailable && isEnabled && (
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isBiometricLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold tracking-wide cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              <Fingerprint className="h-4 w-4" />
              <span>{isBiometricLoading ? 'Verifying...' : 'Unlock with Windows Hello / Passkey'}</span>
            </button>

            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
              <div className="flex-1 h-px bg-[#2e2f42]" />
              <span>Or enter code</span>
              <div className="flex-1 h-px bg-[#2e2f42]" />
            </div>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3 pt-1">
          <input
            type="text"
            value={code}
            onChange={handleChange}
            placeholder="123456 or XXXX-XXXX"
            autoFocus
            className="w-full tracking-widest text-center text-sm font-mono rounded-lg bg-[#11111a] border border-[#2e2f42] px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40 text-left">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
          >
            <span>{isLoading ? 'Verifying...' : 'Unlock App'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
