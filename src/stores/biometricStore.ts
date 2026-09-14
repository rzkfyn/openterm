import { create } from 'zustand';
import { tauriApi } from '../services/tauri';

interface BiometricState {
  isAvailable: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  checkAvailability: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => void;
  authenticate: (reason?: string) => Promise<boolean>;
}

const STORAGE_KEY = 'openterm_biometric_enabled';

export const useBiometricStore = create<BiometricState>((set) => ({
  isAvailable: false,
  isEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === 'true' : false,
  isLoading: false,

  checkAvailability: async () => {
    set({ isLoading: true });
    try {
      const isAvailable = await tauriApi.biometricIsAvailable();
      set({ isAvailable, isLoading: false });
      return isAvailable;
    } catch {
      set({ isAvailable: false, isLoading: false });
      return false;
    }
  },

  setEnabled: (enabled: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    }
    set({ isEnabled: enabled });
  },

  authenticate: async (reason = 'Verify identity to unlock OpenTerm') => {
    return await tauriApi.biometricAuthenticate(reason);
  },
}));
