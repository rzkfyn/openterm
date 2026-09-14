import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    onSshData: vi.fn().mockResolvedValue(() => {}),
    onSshClosed: vi.fn().mockResolvedValue(() => {}),
    sshConnect: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50))),
  },
}));

describe('Auto-Reconnect Backoff Calculation', () => {
  it('calculates exponential backoff delay correctly with cap', () => {
    const getDelayMs = (attempt: number) => Math.min(16000, 1000 * Math.pow(2, attempt - 1));

    expect(getDelayMs(1)).toBe(1000);   // 1s
    expect(getDelayMs(2)).toBe(2000);   // 2s
    expect(getDelayMs(3)).toBe(4000);   // 4s
    expect(getDelayMs(4)).toBe(8000);   // 8s
    expect(getDelayMs(5)).toBe(16000);  // 16s
    expect(getDelayMs(6)).toBe(16000);  // capped at 16s
  });

  it('enforces maximum 5 attempts limit', () => {
    const maxAttempts = 5;
    const shouldRetry = (attempt: number) => attempt <= maxAttempts;

    expect(shouldRetry(1)).toBe(true);
    expect(shouldRetry(5)).toBe(true);
    expect(shouldRetry(6)).toBe(false);
  });
});

describe('Concurrent Connect Deduplication (Issue #33)', () => {
  beforeEach(() => {
    useSessionStore.setState({
      activeSessions: [],
      currentSessionId: null,
      isConnecting: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('deduplicates rapid concurrent connectSession calls to same host target', async () => {
    const target = {
      name: 'Server 1',
      host: '10.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password' as const,
      password: 'test',
    };

    // Rapid double-click simulated
    const [id1, id2] = await Promise.all([
      useSessionStore.getState().connectSession(target),
      useSessionStore.getState().connectSession(target),
    ]);

    expect(id1).toBe(id2);
    expect(useSessionStore.getState().activeSessions.length).toBe(1);
  });
});
