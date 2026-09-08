import { create } from 'zustand';
import { TotpConfig } from '../types';
import { tauriApi } from '../services/tauri';

interface TotpState {
  config: TotpConfig;
  isLoading: boolean;
  loadConfig: () => Promise<TotpConfig>;
  updateIdleTimeout: (mins: number) => Promise<void>;
  setConfig: (config: TotpConfig) => void;
}

export const useTotpStore = create<TotpState>((set) => ({
  config: {
    enabled: false,
    idleTimeoutMins: 15,
    hasBackupCodes: false,
  },
  isLoading: false,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await tauriApi.totpGetConfig();
      set({ config, isLoading: false });
      return config;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateIdleTimeout: async (mins: number) => {
    await tauriApi.totpUpdateIdleTimeout(mins);
    set((state) => ({
      config: { ...state.config, idleTimeoutMins: mins },
    }));
  },

  setConfig: (config: TotpConfig) => set({ config }),
}));
