import { create } from 'zustand';
import { FileEntry } from '../types';
import { tauriApi } from '../services/tauri';

interface PaneState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  entries: FileEntry[];
  total: number;
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  selectedPaths: string[];
}

interface FileManagerState {
  local: PaneState;
  remote: PaneState;

  setLocalSelected: (paths: string[]) => void;
  setRemoteSelected: (paths: string[]) => void;
  
  loadLocalDir: (path: string, offset?: number, append?: boolean, addToHistory?: boolean) => Promise<void>;
  loadRemoteDir: (sessionId: string, path: string, offset?: number, append?: boolean, addToHistory?: boolean) => Promise<void>;

  goBack: (isRemote: boolean, sessionId?: string) => Promise<void>;
  goForward: (isRemote: boolean, sessionId?: string) => Promise<void>;
}

const initialPaneState: PaneState = {
  currentPath: '',
  history: [],
  historyIndex: -1,
  entries: [],
  total: 0,
  offset: 0,
  hasMore: false,
  isLoading: false,
  error: null,
  selectedPaths: [],
};

export const useFileManagerStore = create<FileManagerState>((set) => ({
  local: { ...initialPaneState },
  remote: { ...initialPaneState },

  setLocalSelected: (paths) =>
    set((state) => ({ local: { ...state.local, selectedPaths: paths } })),

  setRemoteSelected: (paths) =>
    set((state) => ({ remote: { ...state.remote, selectedPaths: paths } })),

  loadLocalDir: async (path, offset = 0, append = false, addToHistory = true) => {
    set((state) => ({
      local: { ...state.local, isLoading: true, error: null },
    }));

    try {
      const res = await tauriApi.localListDir(path, offset, 100);
      set((state) => {
        let newHistory = state.local.history;
        let newIndex = state.local.historyIndex;

        if (addToHistory && !append) {
          const currentInHistory = state.local.history[state.local.historyIndex];
          if (currentInHistory !== res.path) {
            newHistory = [...state.local.history.slice(0, state.local.historyIndex + 1), res.path];
            newIndex = newHistory.length - 1;
          }
        }

        return {
          local: {
            ...state.local,
            currentPath: res.path,
            history: newHistory,
            historyIndex: newIndex,
            entries: append ? [...state.local.entries, ...res.entries] : res.entries,
            total: res.total,
            offset: res.offset,
            hasMore: res.hasMore,
            isLoading: false,
          },
        };
      });
    } catch (err: unknown) {
      set((state) => ({
        local: {
          ...state.local,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  },

  loadRemoteDir: async (sessionId, path, offset = 0, append = false, addToHistory = true) => {
    set((state) => ({
      remote: { ...state.remote, isLoading: true, error: null },
    }));

    try {
      const res = await tauriApi.sftpListDir(sessionId, path, offset, 100);
      set((state) => {
        let newHistory = state.remote.history;
        let newIndex = state.remote.historyIndex;

        if (addToHistory && !append) {
          const currentInHistory = state.remote.history[state.remote.historyIndex];
          if (currentInHistory !== res.path) {
            newHistory = [...state.remote.history.slice(0, state.remote.historyIndex + 1), res.path];
            newIndex = newHistory.length - 1;
          }
        }

        return {
          remote: {
            ...state.remote,
            currentPath: res.path,
            history: newHistory,
            historyIndex: newIndex,
            entries: append ? [...state.remote.entries, ...res.entries] : res.entries,
            total: res.total,
            offset: res.offset,
            hasMore: res.hasMore,
            isLoading: false,
          },
        };
      });
    } catch (err: unknown) {
      set((state) => ({
        remote: {
          ...state.remote,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  },

  goBack: async (isRemote, sessionId) => {
    const pane = isRemote ? useFileManagerStore.getState().remote : useFileManagerStore.getState().local;
    if (pane.historyIndex > 0) {
      const prevPath = pane.history[pane.historyIndex - 1];
      if (isRemote) {
        if (!sessionId) return;
        set((state) => ({
          remote: { ...state.remote, historyIndex: state.remote.historyIndex - 1 },
        }));
        await useFileManagerStore.getState().loadRemoteDir(sessionId, prevPath, 0, false, false);
      } else {
        set((state) => ({
          local: { ...state.local, historyIndex: state.local.historyIndex - 1 },
        }));
        await useFileManagerStore.getState().loadLocalDir(prevPath, 0, false, false);
      }
    }
  },

  goForward: async (isRemote, sessionId) => {
    const pane = isRemote ? useFileManagerStore.getState().remote : useFileManagerStore.getState().local;
    if (pane.historyIndex < pane.history.length - 1) {
      const nextPath = pane.history[pane.historyIndex + 1];
      if (isRemote) {
        if (!sessionId) return;
        set((state) => ({
          remote: { ...state.remote, historyIndex: state.remote.historyIndex + 1 },
        }));
        await useFileManagerStore.getState().loadRemoteDir(sessionId, nextPath, 0, false, false);
      } else {
        set((state) => ({
          local: { ...state.local, historyIndex: state.local.historyIndex + 1 },
        }));
        await useFileManagerStore.getState().loadLocalDir(nextPath, 0, false, false);
      }
    }
  },
}));
