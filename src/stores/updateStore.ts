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
  checkStatus: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';
  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: () => void;
}

let statusTimer: ReturnType<typeof setTimeout> | null = null;

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: APP_VERSION,
  latestVersion: null,
  releaseUrl: null,
  hasUpdate: false,
  isChecking: false,
  dismissed: false,
  checkStatus: 'idle',

  checkForUpdates: async (force = false) => {
    if (statusTimer) clearTimeout(statusTimer);
    set({ isChecking: true, checkStatus: 'checking' });
    try {
      const info = await checkLatestRelease(force, APP_VERSION);
      if (info) {
        const nextStatus = info.hasUpdate ? 'update-available' : 'up-to-date';
        set({
          latestVersion: info.latestVersion,
          releaseUrl: info.releaseUrl,
          hasUpdate: info.hasUpdate,
          isChecking: false,
          checkStatus: nextStatus,
        });

        if (!info.hasUpdate) {
          statusTimer = setTimeout(() => {
            set({ checkStatus: 'idle' });
          }, 3500);
        }
      } else {
        set({ isChecking: false, checkStatus: force ? 'error' : 'idle' });
        if (force) {
          statusTimer = setTimeout(() => {
            set({ checkStatus: 'idle' });
          }, 3500);
        }
      }
    } catch {
      set({ isChecking: false, checkStatus: force ? 'error' : 'idle' });
      if (force) {
        statusTimer = setTimeout(() => {
          set({ checkStatus: 'idle' });
        }, 3500);
      }
    }
  },

  dismissUpdate: () => {
    set({ dismissed: true });
  },
}));
