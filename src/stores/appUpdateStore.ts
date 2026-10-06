import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * In-app update install via the Tauri updater plugin.
 *
 * Discovery and release notes still come from the GitHub API (updateStore). This store only
 * downloads, verifies (minisign signature against the pubkey baked into the app) and installs.
 * It never runs on its own: every install starts from an explicit user click.
 */
export type InstallPhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

interface AppUpdateState {
  phase: InstallPhase;
  /** 0..1 while downloading, null when the server sends no content length. */
  progress: number | null;
  error: string | null;
  installUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  reset: () => void;
}

let pending: Update | null = null;

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  phase: 'idle',
  progress: null,
  error: null,

  installUpdate: async () => {
    const { phase } = get();
    if (phase === 'checking' || phase === 'downloading' || phase === 'ready') return;

    set({ phase: 'checking', progress: null, error: null });
    try {
      pending = await check();
      if (!pending) {
        // GitHub says newer but latest.json disagrees (e.g. assets still uploading).
        set({ phase: 'error', error: 'No installable update found yet. Try again in a few minutes.' });
        return;
      }

      let total = 0;
      let received = 0;
      set({ phase: 'downloading', progress: 0 });

      // On Windows the installer takes over and the app exits inside this call.
      await pending.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
          set({ progress: total ? 0 : null });
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          if (total) set({ progress: Math.min(received / total, 1) });
        }
      });

      set({ phase: 'ready', progress: 1 });
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  restartApp: async () => {
    await relaunch();
  },

  reset: () => set({ phase: 'idle', progress: null, error: null }),
}));
