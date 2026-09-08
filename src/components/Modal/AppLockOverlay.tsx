import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';
import { tauriApi } from '../../services/tauri';

interface AppLockOverlayProps {
  isOpen: boolean;
  onUnlock: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({ isOpen, onUnlock }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setIsLoading(true);
    setError(null);
    try {
      const valid = await tauriApi.totpValidateLogin(code);
      if (valid) {
        setCode('');
        onUnlock();
      } else {
        setError('Invalid authentication code or backup recovery code.');
      }
    } catch (err: any) {
      setError(err?.message || 'Validation failed');
    } finally {
      setIsLoading(false);
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
            Enter your 6-digit authenticator code or an 8-character backup recovery code to unlock.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3 pt-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
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
