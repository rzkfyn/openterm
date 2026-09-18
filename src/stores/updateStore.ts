import { create } from 'zustand';
import { checkLatestRelease, fetchReleasesList, ReleaseItem } from '../services/updateChecker';
import { APP_VERSION } from '../version';

interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  hasUpdate: boolean;
  isChecking: boolean;
  dismissed: boolean;
  checkStatus: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

  releases: ReleaseItem[];
  isLoadingReleases: boolean;
  isChangelogOpen: boolean;
  selectedReleaseTag: string | null;

  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: () => void;

  openChangelog: (initialTag?: string) => void;
  closeChangelog: () => void;
  selectRelease: (tagName: string) => void;
  fetchReleases: (force?: boolean) => Promise<void>;
}

let statusTimer: ReturnType<typeof setTimeout> | null = null;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: APP_VERSION,
  latestVersion: null,
  releaseUrl: null,
  hasUpdate: false,
  isChecking: false,
  dismissed: false,
  checkStatus: 'idle',

  releases: [],
  isLoadingReleases: false,
  isChangelogOpen: false,
  selectedReleaseTag: null,

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

  openChangelog: (initialTag?: string) => {
    set({
      isChangelogOpen: true,
      ...(initialTag ? { selectedReleaseTag: initialTag } : {}),
    });
    get().fetchReleases();
  },

  closeChangelog: () => {
    set({ isChangelogOpen: false });
  },

  selectRelease: (tagName: string) => {
    set({ selectedReleaseTag: tagName });
  },

  fetchReleases: async (force = false) => {
    set({ isLoadingReleases: true });
    try {
      const releases = await fetchReleasesList(force);
      set((state) => {
        const shouldSelectFirst = (!state.selectedReleaseTag || state.selectedReleaseTag.trim() === '') && releases.length > 0;
        return {
          releases,
          isLoadingReleases: false,
          selectedReleaseTag: shouldSelectFirst ? releases[0].tagName : state.selectedReleaseTag,
        };
      });
    } catch {
      set({ isLoadingReleases: false });
    }
  },
}));
