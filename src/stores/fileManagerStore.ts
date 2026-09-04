import { create } from 'zustand';
import { FileEntry } from '../types';
import { tauriApi } from '../services/tauri';

interface PaneState {
  currentPath: string;
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
  
  loadLocalDir: (path: string, offset?: number, append?: boolean) => Promise<void>;
  loadRemoteDir: (sessionId: string, path: string, offset?: number, append?: boolean) => Promise<void>;
}

const initialPaneState: PaneState = {
  currentPath: '',
  entries: [],
  total: 0,
  offset: 0,
  hasMore: false,
  isLoading: false,
  error: null,
  selectedPaths: [],
};

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  local: { ...initialPaneState },
  remote: { ...initialPaneState },

  setLocalSelected: (paths) =>
    set((state) => ({ local: { ...state.local, selectedPaths: paths } })),

  setRemoteSelected: (paths) =>
    set((state) => ({ remote: { ...state.remote, selectedPaths: paths } })),

  loadLocalDir: async (path, offset = 0, append = false) => {
    set((state) => ({
      local: { ...state.local, isLoading: true, error: null },
    }));

    try {
      const res = await tauriApi.localListDir(path, offset, 100);
      set((state) => ({
        local: {
          ...state.local,
          currentPath: res.path,
          entries: append ? [...state.local.entries, ...res.entries] : res.entries,
          total: res.total,
          offset: res.offset,
          hasMore: res.hasMore,
          isLoading: false,
        },
      }));
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

  loadRemoteDir: async (sessionId, path, offset = 0, append = false) => {
    set((state) => ({
      remote: { ...state.remote, isLoading: true, error: null },
    }));

    try {
      const res = await tauriApi.sftpListDir(sessionId, path, offset, 100);
      set((state) => ({
        remote: {
          ...state.remote,
          currentPath: res.path,
          entries: append ? [...state.remote.entries, ...res.entries] : res.entries,
          total: res.total,
          offset: res.offset,
          hasMore: res.hasMore,
          isLoading: false,
        },
      }));
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
}));
