import { describe, it, expect, vi } from 'vitest';
import { useSessionStore } from '../sessionStore';
import { useTransferStore } from '../transferStore';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    sshConnect: vi.fn().mockResolvedValue('test-sess-123'),
    sshDisconnect: vi.fn().mockResolvedValue(undefined),
    onTransferProgress: vi.fn().mockResolvedValue(() => {}),
    sftpDownload: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Zustand Stores', () => {
  it('handles session connect and view mode switching', async () => {
    const store = useSessionStore.getState();
    store.setViewMode('terminal');
    expect(useSessionStore.getState().viewMode).toBe('terminal');

    const sessId = await store.connectSession({
      name: 'Server 1',
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      authType: 'password',
      password: 'secret',
    });

    expect(sessId).toBe('test-sess-123');
    expect(useSessionStore.getState().currentSessionId).toBe('test-sess-123');
    expect(useSessionStore.getState().activeSessions.length).toBe(1);

    await useSessionStore.getState().disconnectSession('test-sess-123');
    expect(useSessionStore.getState().activeSessions.length).toBe(0);
    expect(useSessionStore.getState().currentSessionId).toBe(null);
  });

  it('manages transfer store progress updates', () => {
    const tStore = useTransferStore.getState();
    tStore.updateTransferProgress({
      transferId: 'tx-1',
      fileName: 'backup.tar.gz',
      bytesTransferred: 50,
      totalBytes: 100,
      percentage: 50,
      status: 'transferring',
    });

    expect(useTransferStore.getState().transfers['tx-1'].percentage).toBe(50);
  });
});
