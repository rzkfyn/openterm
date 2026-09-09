import { create } from 'zustand';
import { SessionConfig, ViewMode, ConnectionBookmark } from '../types';
import { tauriApi } from '../services/tauri';
import { useFileManagerStore } from './fileManagerStore';
import { useSavedConnectionStore } from './savedConnectionStore';

// Global session stream registry:
// Tauri listener stays alive for the entire duration of the session
// (survives React StrictMode double-mounts, view mode switches, and tab changes).
const sessionListeners = new Map<string, () => void>();
const sessionClosedListeners = new Map<string, () => void>();
const sessionLiveCallbacks = new Map<string, (chunk: string) => void>();
const sessionOutputHistory = new Map<string, string[]>();
const intentionalDisconnects = new Set<string>();
const reconnectAttemptsMap = new Map<string, number>();
const reconnectTimerMap = new Map<string, any>();

function emitTerminalNotice(sessionId: string, message: string) {
  const history = sessionOutputHistory.get(sessionId);
  if (history) {
    history.push(message);
    if (history.length > 1000) history.shift();
  }
  const liveCb = sessionLiveCallbacks.get(sessionId);
  if (liveCb) {
    liveCb(message);
  }
}

async function attemptAutoReconnect(sessionId: string) {
  const session = useSessionStore.getState().activeSessions.find((s) => s.id === sessionId);
  if (!session || intentionalDisconnects.has(sessionId)) return;

  const currentAttempt = (reconnectAttemptsMap.get(sessionId) || 0) + 1;
  const maxAttempts = 5;

  if (currentAttempt > maxAttempts) {
    reconnectAttemptsMap.delete(sessionId);
    useSessionStore.getState().markSessionClosed(sessionId);
    emitTerminalNotice(
      sessionId,
      `\r\n\x1b[31m[OpenTerm: Auto-reconnect failed after ${maxAttempts} attempts. Click Reconnect to retry.]\x1b[0m\r\n`
    );
    return;
  }

  reconnectAttemptsMap.set(sessionId, currentAttempt);
  const delayMs = Math.min(16000, 1000 * Math.pow(2, currentAttempt - 1));

  useSessionStore.setState((state) => ({
    activeSessions: state.activeSessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'reconnecting' } : s
    ),
  }));

  emitTerminalNotice(
    sessionId,
    `\r\n\x1b[33m[OpenTerm: Connection dropped. Auto-reconnecting (attempt ${currentAttempt}/${maxAttempts}) in ${delayMs / 1000}s...]\x1b[0m\r\n`
  );

  const timer = setTimeout(async () => {
    try {
      await useSessionStore.getState().reconnectSession(sessionId);
    } catch {
      attemptAutoReconnect(sessionId);
    }
  }, delayMs);

  reconnectTimerMap.set(sessionId, timer);
}

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
  reconnectSession: (id: string) => Promise<void>;
  disconnectSession: (id: string) => Promise<void>;
  disconnectOtherSessions: (keepId: string) => Promise<void>;
  disconnectAllSessions: () => Promise<void>;
  addSessionBookmark: (sessionId: string, bookmark: ConnectionBookmark) => Promise<void>;
  removeSessionBookmark: (sessionId: string, bookmarkId: string) => Promise<void>;
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
      const sessionId = config.id || crypto.randomUUID();
      intentionalDisconnects.delete(sessionId);
      reconnectAttemptsMap.delete(sessionId);

      // Initialize buffer for this session
      if (!sessionOutputHistory.has(sessionId)) {
        sessionOutputHistory.set(sessionId, []);
      }

      // Register persistent Tauri listener BEFORE connecting
      const unlisten = await tauriApi.onSshData(sessionId, (chunk) => {
        const history = sessionOutputHistory.get(sessionId);
        if (history) {
          history.push(chunk);
          if (history.length > 1000) history.shift();
        }
        const liveCb = sessionLiveCallbacks.get(sessionId);
        if (liveCb) {
          liveCb(chunk);
        }
      });
      sessionListeners.set(sessionId, unlisten);

      const unlistenClosed = await tauriApi.onSshClosed(sessionId, () => {
        attemptAutoReconnect(sessionId);
      });
      sessionClosedListeners.set(sessionId, unlistenClosed);

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

  reconnectSession: async (id) => {
    if (reconnectTimerMap.has(id)) {
      clearTimeout(reconnectTimerMap.get(id));
      reconnectTimerMap.delete(id);
    }

    const session = useSessionStore.getState().activeSessions.find((s) => s.id === id);
    if (!session) return;

    intentionalDisconnects.delete(id);

    useSessionStore.setState((state) => ({
      activeSessions: state.activeSessions.map((s) =>
        s.id === id ? { ...s, status: 'reconnecting' } : s
      ),
    }));

    try {
      await tauriApi.sshDisconnect(id);
    } catch {}

    const oldUnlisten = sessionListeners.get(id);
    if (oldUnlisten) {
      oldUnlisten();
      sessionListeners.delete(id);
    }
    const oldClosedUnlisten = sessionClosedListeners.get(id);
    if (oldClosedUnlisten) {
      oldClosedUnlisten();
      sessionClosedListeners.delete(id);
    }

    const unlistenData = await tauriApi.onSshData(id, (chunk) => {
      const history = sessionOutputHistory.get(id);
      if (history) {
        history.push(chunk);
        if (history.length > 1000) history.shift();
      }
      const liveCb = sessionLiveCallbacks.get(id);
      if (liveCb) {
        liveCb(chunk);
      }
    });
    sessionListeners.set(id, unlistenData);

    const unlistenClosed = await tauriApi.onSshClosed(id, () => {
      attemptAutoReconnect(id);
    });
    sessionClosedListeners.set(id, unlistenClosed);

    await tauriApi.sshConnect({ ...session, id });

    reconnectAttemptsMap.delete(id);
    emitTerminalNotice(id, '\r\n\x1b[32m[OpenTerm: Connection restored successfully!]\x1b[0m\r\n');

    // Restore remote SFTP directory if active
    try {
      const fileStore = useFileManagerStore.getState();
      if (fileStore.remote.currentPath) {
        fileStore.loadRemoteDir(id, fileStore.remote.currentPath).catch(() => {});
      }
    } catch {}

    useSessionStore.setState((state) => ({
      activeSessions: state.activeSessions.map((s) =>
        s.id === id ? { ...s, status: 'connected' } : s
      ),
    }));
  },

  disconnectSession: async (id) => {
    intentionalDisconnects.add(id);
    if (reconnectTimerMap.has(id)) {
      clearTimeout(reconnectTimerMap.get(id));
      reconnectTimerMap.delete(id);
    }
    reconnectAttemptsMap.delete(id);

    const unlisten = sessionListeners.get(id);
    if (unlisten) {
      unlisten();
      sessionListeners.delete(id);
    }
    const unlistenClosed = sessionClosedListeners.get(id);
    if (unlistenClosed) {
      unlistenClosed();
      sessionClosedListeners.delete(id);
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

  disconnectOtherSessions: async (keepId) => {
    const { activeSessions, disconnectSession } = useSessionStore.getState();
    const toDisconnect = activeSessions.filter((s) => s.id !== keepId);
    for (const session of toDisconnect) {
      if (session.id) {
        await disconnectSession(session.id);
      }
    }
  },

  disconnectAllSessions: async () => {
    const { activeSessions, disconnectSession } = useSessionStore.getState();
    for (const session of activeSessions) {
      if (session.id) {
        await disconnectSession(session.id);
      }
    }
  },

  addSessionBookmark: async (sessionId, bookmark) => {
    set((state) => {
      const nextSessions = state.activeSessions.map((s) => {
        if (s.id === sessionId) {
          const currentBookmarks = s.bookmarks || [];
          return { ...s, bookmarks: [...currentBookmarks, bookmark] };
        }
        return s;
      });
      return { activeSessions: nextSessions };
    });

    const session = useSessionStore.getState().activeSessions.find((s) => s.id === sessionId);
    if (session) {
      const { connections, save } = useSavedConnectionStore.getState();
      const matched = connections.find(
        (c) => c.id === session.id || (c.host === session.host && c.username === session.username)
      );
      if (matched) {
        const existing = matched.bookmarks || [];
        await save({ ...matched, bookmarks: [...existing, bookmark] });
      }
    }
  },

  removeSessionBookmark: async (sessionId, bookmarkId) => {
    set((state) => {
      const nextSessions = state.activeSessions.map((s) => {
        if (s.id === sessionId) {
          const currentBookmarks = s.bookmarks || [];
          return { ...s, bookmarks: currentBookmarks.filter((b) => b.id !== bookmarkId) };
        }
        return s;
      });
      return { activeSessions: nextSessions };
    });

    const session = useSessionStore.getState().activeSessions.find((s) => s.id === sessionId);
    if (session) {
      const { connections, save } = useSavedConnectionStore.getState();
      const matched = connections.find(
        (c) => c.id === session.id || (c.host === session.host && c.username === session.username)
      );
      if (matched) {
        const existing = matched.bookmarks || [];
        await save({ ...matched, bookmarks: existing.filter((b) => b.id !== bookmarkId) });
      }
    }
  },
}));
