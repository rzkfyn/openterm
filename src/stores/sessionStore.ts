import { create } from 'zustand';
import { SessionConfig, ViewMode } from '../types';
import { tauriApi } from '../services/tauri';

// Buffer SSH data that arrives before terminal mounts.
// The early listener stays active until takeoverEarlyBuffer replaces its
// callback with the live terminal writer — zero gap, zero data loss.
const earlyBuffers = new Map<string, string[]>();
const earlyCallbacks = new Map<string, { fn: (chunk: string) => void }>();
const earlyUnlisteners = new Map<string, () => void>();

/**
 * Drain buffered chunks and atomically redirect future data to `liveCb`.
 * The underlying Tauri listener stays — caller is responsible for
 * unlistening via the returned function.
 */
export function takeoverEarlyBuffer(
  sessionId: string,
  liveCb: (chunk: string) => void,
): { buffered: string[]; unlisten: (() => void) | null } {
  const buf = earlyBuffers.get(sessionId) || [];
  earlyBuffers.delete(sessionId);

  // Redirect: any data arriving from now on goes straight to liveCb
  const wrapper = earlyCallbacks.get(sessionId);
  if (wrapper) {
    wrapper.fn = liveCb;
    earlyCallbacks.delete(sessionId);
  }

  const unlisten = earlyUnlisteners.get(sessionId) || null;
  earlyUnlisteners.delete(sessionId);

  return { buffered: buf, unlisten };
}

interface SessionState {
  activeSessions: SessionConfig[];
  currentSessionId: string | null;
  viewMode: ViewMode;
  isConnecting: boolean;
  error: string | null;
  
  setViewMode: (mode: ViewMode) => void;
  setCurrentSessionId: (id: string | null) => void;
  markSessionClosed: (id: string) => void;
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

  markSessionClosed: (id) => {
    set((state) => ({
      activeSessions: state.activeSessions.map((s) =>
        s.id === id ? { ...s, status: 'disconnected' } : s
      ),
    }));
  },

  connectSession: async (config) => {
    set({ isConnecting: true, error: null });
    try {
      // Generate ID upfront so we can listen before connect
      const sessionId = config.id || crypto.randomUUID();

      // Register listener BEFORE connect so no data is lost
      earlyBuffers.set(sessionId, []);
      const wrapper = { fn: (chunk: string) => {
        const buf = earlyBuffers.get(sessionId);
        if (buf) buf.push(chunk);
      }};
      earlyCallbacks.set(sessionId, wrapper);
      const earlyUnlisten = await tauriApi.onSshData(sessionId, (chunk) => {
        wrapper.fn(chunk);
      });
      earlyUnlisteners.set(sessionId, earlyUnlisten);

      await tauriApi.sshConnect({ ...config, id: sessionId });

      const sessionWithId: SessionConfig = { ...config, id: sessionId, status: 'connected' };
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
