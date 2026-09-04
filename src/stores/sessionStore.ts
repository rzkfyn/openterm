import { create } from 'zustand';
import { SessionConfig, ViewMode } from '../types';
import { tauriApi } from '../services/tauri';

interface SessionState {
  activeSessions: SessionConfig[];
  currentSessionId: string | null;
  viewMode: ViewMode;
  isConnecting: boolean;
  error: string | null;
  
  setViewMode: (mode: ViewMode) => void;
  setCurrentSessionId: (id: string | null) => void;
  connectSession: (config: SessionConfig) => Promise<string>;
  disconnectSession: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSessions: [],
  currentSessionId: null,
  viewMode: 'split',
  isConnecting: false,
  error: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  clearError: () => set({ error: null }),

  connectSession: async (config) => {
    set({ isConnecting: true, error: null });
    try {
      const sessionId = await tauriApi.sshConnect(config);
      const sessionWithId = { ...config, id: sessionId };
      set((state) => ({
        activeSessions: [...state.activeSessions.filter((s) => s.id !== sessionId), sessionWithId],
        currentSessionId: sessionId,
        isConnecting: false,
      }));
      return sessionId;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ isConnecting: false, error: errMsg });
      throw err;
    }
  },

  disconnectSession: async (id) => {
    try {
      await tauriApi.sshDisconnect(id);
    } catch (e) {
      console.error('Failed to cleanly disconnect session:', e);
    }
    set((state) => {
      const nextSessions = state.activeSessions.filter((s) => s.id !== id);
      const nextCurrentId =
        state.currentSessionId === id
          ? nextSessions.length > 0
            ? nextSessions[0].id ?? null
            : null
          : state.currentSessionId;
      return {
        activeSessions: nextSessions,
        currentSessionId: nextCurrentId,
      };
    });
  },
}));
