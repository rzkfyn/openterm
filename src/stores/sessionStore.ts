import { create } from 'zustand';
import { SessionConfig, ViewMode } from '../types';
import { tauriApi } from '../services/tauri';

// Global session stream registry:
// Tauri listener stays alive for the entire duration of the session
// (survives React StrictMode double-mounts, view mode switches, and tab changes).
const sessionListeners = new Map<string, () => void>();
const sessionLiveCallbacks = new Map<string, (chunk: string) => void>();
const sessionOutputHistory = new Map<string, string[]>();

/**
 * Attach a terminal view to a session's live data stream.
 * Returns all output buffered since session start so terminal can replay it.
 */
export function attachTerminalSubscriber(
  sessionId: string,
  onData: (chunk: string) => void,
): { buffered: string[] } {
  sessionLiveCallbacks.set(sessionId, onData);
  const history = sessionOutputHistory.get(sessionId) || [];
  return { buffered: [...history] };
}

/**
 * Detach terminal view from live stream (on component unmount).
 * Does NOT kill the Tauri listener — session keeps receiving and buffering data.
 */
export function detachTerminalSubscriber(sessionId: string) {
  sessionLiveCallbacks.delete(sessionId);
}

// Backward-compat export if needed
export function takeoverEarlyBuffer(
  sessionId: string,
  liveCb: (chunk: string) => void,
): { buffered: string[]; unlisten: (() => void) | null } {
  const { buffered } = attachTerminalSubscriber(sessionId, liveCb);
  return { buffered, unlisten: () => detachTerminalSubscriber(sessionId) };
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

export const useSessionStore = create<SessionState>((set) => ({
  activeSessions: [],
  currentSessionId: null,
  viewMode: 'terminal',
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

      // Initialize buffer for this session
      sessionOutputHistory.set(sessionId, []);

      // Register persistent Tauri listener BEFORE connecting so zero initial output is lost
      const unlisten = await tauriApi.onSshData(sessionId, (chunk) => {
        const history = sessionOutputHistory.get(sessionId);
        if (history) {
          history.push(chunk);
          // ponytail: keep last 1000 chunks; upgrade to disk ring buffer if heavy output
          if (history.length > 1000) history.shift();
        }
        const liveCb = sessionLiveCallbacks.get(sessionId);
        if (liveCb) {
          liveCb(chunk);
        }
      });
      sessionListeners.set(sessionId, unlisten);

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
    // Unlisten from Tauri event
    const unlisten = sessionListeners.get(id);
    if (unlisten) {
      unlisten();
      sessionListeners.delete(id);
    }
    sessionLiveCallbacks.delete(id);
    sessionOutputHistory.delete(id);

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
