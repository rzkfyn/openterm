import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTotpStore } from '../totpStore';
import { tauriApi } from '../../services/tauri';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    totpGetConfig: vi.fn(),
    totpUpdateIdleTimeout: vi.fn(),
  },
}));

describe('useTotpStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly handles 0 minutes timeout (disabled)', async () => {
    vi.mocked(tauriApi.totpGetConfig).mockResolvedValueOnce({
      enabled: true,
      idleTimeoutMins: 0,
      hasBackupCodes: true,
    });

    await useTotpStore.getState().loadConfig();
    const config = useTotpStore.getState().config;
    expect(config.idleTimeoutMins).toBe(0);
  });

  it('updates idle timeout reactively', async () => {
    vi.mocked(tauriApi.totpUpdateIdleTimeout).mockResolvedValueOnce();

    await useTotpStore.getState().updateIdleTimeout(30);
    expect(tauriApi.totpUpdateIdleTimeout).toHaveBeenCalledWith(30);
    expect(useTotpStore.getState().config.idleTimeoutMins).toBe(30);
  });
});
