import { create } from 'zustand';
import { checkLatestRelease } from '../services/updateChecker';
import { APP_VERSION } from '../version';

interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  hasUpdate: boolean;
  isChecking: boolean;
  dismissed: boolean;
  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: APP_VERSION,
  latestVersion: null,
  releaseUrl: null,
  hasUpdate: false,
  isChecking: false,
  dismissed: false,

  checkForUpdates: async (force = false) => {
    set({ isChecking: true });
    try {
      const info = await checkLatestRelease(force, APP_VERSION);
      if (info) {
        set({
          latestVersion: info.latestVersion,
          releaseUrl: info.releaseUrl,
          hasUpdate: info.hasUpdate,
          isChecking: false,
        });
      } else {
        set({ isChecking: false });
      }
    } catch {
      set({ isChecking: false });
    }
  },

  dismissUpdate: () => {
    set({ dismissed: true });
  },
}));
