import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBiometricStore } from '../biometricStore';
import { tauriApi } from '../../services/tauri';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    biometricIsAvailable: vi.fn(),
    biometricAuthenticate: vi.fn(),
  },
}));

describe('useBiometricStore', () => {
  const storeMap: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).localStorage = {
      getItem: (key: string) => storeMap[key] ?? null,
      setItem: (key: string, val: string) => {
        storeMap[key] = val;
      },
      clear: () => {
        Object.keys(storeMap).forEach((k) => delete storeMap[k]);
      },
    };
    (globalThis as any).localStorage.clear();
  });

  it('checks availability from tauriApi', async () => {
    vi.mocked(tauriApi.biometricIsAvailable).mockResolvedValueOnce(true);

    const available = await useBiometricStore.getState().checkAvailability();
    expect(available).toBe(true);
    expect(useBiometricStore.getState().isAvailable).toBe(true);
  });

  it('updates isEnabled and persists to localStorage', () => {
    useBiometricStore.getState().setEnabled(true);
    expect(useBiometricStore.getState().isEnabled).toBe(true);
    expect(localStorage.getItem('openterm_biometric_enabled')).toBe('true');

    useBiometricStore.getState().setEnabled(false);
    expect(useBiometricStore.getState().isEnabled).toBe(false);
    expect(localStorage.getItem('openterm_biometric_enabled')).toBe('false');
  });

  it('calls tauriApi.biometricAuthenticate', async () => {
    vi.mocked(tauriApi.biometricAuthenticate).mockResolvedValueOnce(true);

    const verified = await useBiometricStore.getState().authenticate('Unlock OpenTerm');
    expect(tauriApi.biometricAuthenticate).toHaveBeenCalledWith('Unlock OpenTerm');
    expect(verified).toBe(true);
  });
});
