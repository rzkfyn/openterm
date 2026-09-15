import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Copy, Check, AlertCircle, Fingerprint, KeyRound, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
import { tauriApi } from '../../services/tauri';
import { TotpConfig, TotpSetupInfo } from '../../types';
import { useTotpStore } from '../../stores/totpStore';
import { useBiometricStore } from '../../stores/biometricStore';
import { getBiometricName } from '../../utils/platform';

interface TotpModalProps {
  isOpen: boolean;
  config: TotpConfig;
  onClose: () => void;
  onConfigChange: () => void;
}

export const TotpModal: React.FC<TotpModalProps> = ({
  isOpen,
  config,
  onClose,
  onConfigChange,
}) => {
  const [setupInfo, setSetupInfo] = useState<TotpSetupInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [selectedTimeout, setSelectedTimeout] = useState<number>(config.idleTimeoutMins || 15);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const {
    isAvailable: isBiometricAvailable,
    isEnabled: isBiometricEnabled,
    checkAvailability: checkBiometricAvailability,
    setEnabled: setBiometricEnabled,
    authenticate: authenticateBiometric,
  } = useBiometricStore();

  useEffect(() => {
    if (isOpen) {
      checkBiometricAvailability();
    }
  }, [isOpen, checkBiometricAvailability]);

  const handleToggleBiometric = async () => {
    const bioName = getBiometricName();
    if (isBiometricEnabled) {
      setBiometricEnabled(false);
    } else {
      setBiometricLoading(true);
      setError(null);
      try {
        const verified = await authenticateBiometric(`Enable ${bioName} / Passkey for OpenTerm`);
        if (verified) {
          setBiometricEnabled(true);
        } else {
          setError('Biometric verification cancelled or failed.');
        }
      } catch (err: any) {
        setError(err?.message || 'Biometric verification failed.');
      } finally {
        setBiometricLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSetupInfo(null);
      setVerifyCode('');
      setBackupCodes(null);
      setError(null);
      setDisableCode('');
      return;
    }

    if (!config.enabled) {
      tauriApi.totpGenerateSecret().then((info) => {
        setSetupInfo(info);
      });
    } else {
      setSelectedTimeout(config.idleTimeoutMins ?? 15);
    }
  }, [isOpen, config.enabled, config.idleTimeoutMins]);

  useEffect(() => {
    if (setupInfo?.uri) {
      QRCode.toDataURL(setupInfo.uri, {
        margin: 1,
        width: 160,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [setupInfo?.uri]);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (!setupInfo) return;
    navigator.clipboard.writeText(setupInfo.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupInfo || !verifyCode) return;

    setIsLoading(true);
    setError(null);
    try {
      const codes = await tauriApi.totpEnable(setupInfo.secret, verifyCode);
      setBackupCodes(codes);
      onConfigChange();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode) return;

    setIsLoading(true);
    setError(null);
    try {
      await tauriApi.totpDisable(disableCode);
      onConfigChange();
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTimeout = async (mins: number) => {
    setSelectedTimeout(mins);
    try {
      await useTotpStore.getState().updateIdleTimeout(mins);
      onConfigChange();
    } catch (err) {
      console.error('Failed to update idle timeout:', err);
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const bioName = getBiometricName();
      const verified = await authenticateBiometric(
        `Verify identity with ${bioName} to generate emergency recovery codes`
      );
      if (verified) {
        const codes = await tauriApi.totpGenerateEmergencyRecoveryCodes();
        setBackupCodes(codes);
        onConfigChange();
      } else {
        setError('Verification cancelled or failed. Recovery codes were not generated.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate recovery codes');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#181824] border border-[#2a2b38] p-5 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2a2b38]">
          <div>
            <h3 className="text-sm font-semibold text-white">App Security & 2FA</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {config.enabled ? 'Two-factor authentication is active' : 'Secure OpenTerm with an Authenticator App'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Enabled State Management */}
        {config.enabled && !backupCodes ? (
          <div className="mt-4 space-y-4">
            {/* Settings Card */}
            <div className="rounded-lg bg-[#11111a] border border-[#2a2b38] divide-y divide-[#262738] overflow-hidden">
              {/* Row 1: Biometrics / Passkey */}
              {isBiometricAvailable && (
                <div className="flex items-center justify-between p-3.5 gap-3">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">
                          {getBiometricName()} / Passkey
                        </span>
                        {isBiometricEnabled && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Unlock using biometric authentication alongside 2FA
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBiometric}
                    disabled={biometricLoading}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      isBiometricEnabled
                        ? 'bg-[#1e1e2d] border border-[#2a2b38] text-slate-300 hover:text-white hover:border-slate-500'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {biometricLoading
                      ? 'Verifying...'
                      : isBiometricEnabled
                      ? 'Disable'
                      : 'Enable'}
                  </button>
                </div>
              )}

              {/* Row 2: Emergency Recovery Codes */}
              {isBiometricEnabled && (
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-slate-200">
                          Emergency Recovery Kit
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Backup codes in case biometrics or device reset
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {config.hasBackupCodes ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Missing
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateRecoveryCodes}
                    disabled={biometricLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {biometricLoading
                        ? `Verifying with ${getBiometricName()}...`
                        : config.hasBackupCodes
                        ? 'Regenerate Emergency Codes'
                        : 'Generate Emergency Codes'}
                    </span>
                  </button>
                </div>
              )}

              {/* Row 3: Auto-Lock Timeout */}
              <div className="flex items-center justify-between p-3.5 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-200">Auto-Lock on Idle</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Lock workspace after inactivity
                  </p>
                </div>
                <div className="relative w-44 shrink-0">
                  <select
                    value={selectedTimeout}
                    onChange={(e) => handleSaveTimeout(Number(e.target.value))}
                    className="w-full rounded-md bg-[#181824] border border-[#2a2b38] focus:border-indigo-500/80 pl-3 pr-8 py-1.5 text-xs text-slate-100 outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value={5} className="bg-[#181824] text-slate-200">5 Minutes</option>
                    <option value={15} className="bg-[#181824] text-slate-200">15 Minutes (Default)</option>
                    <option value={30} className="bg-[#181824] text-slate-200">30 Minutes</option>
                    <option value={60} className="bg-[#181824] text-slate-200">1 Hour</option>
                    <option value={0} className="bg-[#181824] text-slate-200">Disabled (Manual only)</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Disable 2FA Section */}
            <form onSubmit={handleDisableTotp} className="pt-3 border-t border-[#262738] space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Disable Two-Factor Authentication
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="Enter 6-digit code or backup code"
                  className="flex-1 rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-rose-500/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isLoading || !disableCode}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-rose-600/80 hover:bg-rose-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isLoading ? 'Checking...' : 'Disable 2FA'}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded-md border border-rose-800/40">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          </div>
        ) : backupCodes ? (
          /* Backup codes display after successful activation */
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <Check className="h-4 w-4" />
              <span>2FA Activated Successfully!</span>
            </div>
            <p className="text-xs text-slate-300">
              Save these one-time recovery backup codes in a safe place. You can use them to unlock OpenTerm if you lose your phone:
            </p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded bg-[#11111a] border border-[#262738] font-mono text-xs text-slate-200">
              {backupCodes.map((c, i) => (
                <div key={i} className="text-center py-1 bg-[#181824] rounded border border-[#222332]">
                  {c}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleCopyBackupCodes}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#252636] hover:bg-[#2e3046] text-slate-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy All Codes'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Setup / Activation view */
          <form onSubmit={handleEnableTotp} className="mt-4 space-y-3">
            <p className="text-xs text-slate-300">
              Scan barcode or enter key in your authenticator app (Google Authenticator, Aegis, 1Password, etc.):
            </p>

            {/* QR Code display */}
            {qrDataUrl && (
              <div className="flex flex-col items-center justify-center p-3 rounded bg-[#11111a] border border-[#262738]">
                <img
                  src={qrDataUrl}
                  alt="2FA QR Code"
                  className="h-36 w-36 rounded bg-white p-1.5 shadow-md"
                />
                <span className="text-[10.5px] text-slate-400 mt-1.5">
                  Scan with Authenticator app camera
                </span>
              </div>
            )}

            {/* Secret key box */}
            {setupInfo && (
              <div className="p-3 rounded bg-[#11111a] border border-[#262738] space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Secret Key:</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-100 font-semibold tracking-wider select-all break-all">
                  {setupInfo.secret}
                </div>
              </div>
            )}

            {/* Code input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Enter 6-digit code from app to verify:
              </label>
              <input
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full tracking-widest text-center text-sm font-mono rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-3 py-2 text-white placeholder-slate-600 outline-none transition-colors"
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
                className="px-3 py-1.5 text-xs rounded bg-[#252636] text-slate-300 hover:bg-[#2e3046] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || verifyCode.length !== 6}
                className="px-4 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isLoading ? 'Verifying...' : 'Activate 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
