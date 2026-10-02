import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFileManagerStore } from '../fileManagerStore';
import { tauriApi } from '../../services/tauri';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    sftpListDir: vi.fn(),
    localListDir: vi.fn(),
  },
}));

describe('Issue #40: SFTP Remote Path Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileManagerStore.setState({
      remotePathBySession: {},
      remote: {
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
      },
    });
  });

  it('records remote directory path per session on loadRemoteDir', async () => {
    vi.mocked(tauriApi.sftpListDir).mockResolvedValueOnce({
      path: '/var/log/nginx',
      entries: [],
      total: 0,
      offset: 0,
      limit: 100,
      hasMore: false,
    });

    await useFileManagerStore.getState().loadRemoteDir('session-1', '/var/log/nginx');

    const state = useFileManagerStore.getState();
    expect(state.remote.currentPath).toBe('/var/log/nginx');
    expect(state.remotePathBySession['session-1']).toBe('/var/log/nginx');
  });

  it('preserves distinct paths across multiple sessions', async () => {
    vi.mocked(tauriApi.sftpListDir)
      .mockResolvedValueOnce({
        path: '/etc/nginx',
        entries: [],
        total: 0,
        offset: 0,
        limit: 100,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        path: '/home/ubuntu/app',
        entries: [],
        total: 0,
        offset: 0,
        limit: 100,
        hasMore: false,
      });

    await useFileManagerStore.getState().loadRemoteDir('session-1', '/etc/nginx');
    await useFileManagerStore.getState().loadRemoteDir('session-2', '/home/ubuntu/app');

    const state = useFileManagerStore.getState();
    expect(state.remotePathBySession['session-1']).toBe('/etc/nginx');
    expect(state.remotePathBySession['session-2']).toBe('/home/ubuntu/app');
  });

  it('clears remote path when clearSessionRemotePath is called', async () => {
    useFileManagerStore.setState({
      remotePathBySession: {
        'session-1': '/var/log',
        'session-2': '/etc',
      },
    });

    useFileManagerStore.getState().clearSessionRemotePath('session-1');

    const state = useFileManagerStore.getState();
    expect(state.remotePathBySession['session-1']).toBeUndefined();
    expect(state.remotePathBySession['session-2']).toBe('/etc');
  });
});
