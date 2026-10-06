import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheck = vi.fn();
const mockRelaunch = vi.fn();
vi.mock('@tauri-apps/plugin-updater', () => ({ check: (...a: any[]) => mockCheck(...a) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: (...a: any[]) => mockRelaunch(...a) }));

import { useAppUpdateStore } from '../appUpdateStore';

type Cb = (e: any) => void;

describe('useAppUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppUpdateStore.getState().reset();
  });

  it('downloads with progress and ends ready to restart', async () => {
    const progressSeen: (number | null)[] = [];
    mockCheck.mockResolvedValue({
      downloadAndInstall: async (cb: Cb) => {
        cb({ event: 'Started', data: { contentLength: 200 } });
        cb({ event: 'Progress', data: { chunkLength: 50 } });
        progressSeen.push(useAppUpdateStore.getState().progress);
        cb({ event: 'Progress', data: { chunkLength: 150 } });
        progressSeen.push(useAppUpdateStore.getState().progress);
        cb({ event: 'Finished', data: {} });
      },
    });

    await useAppUpdateStore.getState().installUpdate();

    expect(progressSeen).toEqual([0.25, 1]);
    expect(useAppUpdateStore.getState().phase).toBe('ready');
    await useAppUpdateStore.getState().restartApp();
    expect(mockRelaunch).toHaveBeenCalledOnce();
  });

  it('reports unknown size as indeterminate progress', async () => {
    let mid: number | null | undefined;
    mockCheck.mockResolvedValue({
      downloadAndInstall: async (cb: Cb) => {
        cb({ event: 'Started', data: {} });
        cb({ event: 'Progress', data: { chunkLength: 10 } });
        mid = useAppUpdateStore.getState().progress;
      },
    });
    await useAppUpdateStore.getState().installUpdate();
    expect(mid).toBeNull();
  });

  it('errors when latest.json has no newer version', async () => {
    mockCheck.mockResolvedValue(null);
    await useAppUpdateStore.getState().installUpdate();
    const s = useAppUpdateStore.getState();
    expect(s.phase).toBe('error');
    expect(s.error).toMatch(/No installable update/);
  });

  it('surfaces signature / network failures as error', async () => {
    mockCheck.mockResolvedValue({
      downloadAndInstall: async () => {
        throw new Error('signature verification failed');
      },
    });
    await useAppUpdateStore.getState().installUpdate();
    expect(useAppUpdateStore.getState()).toMatchObject({
      phase: 'error',
      error: 'signature verification failed',
    });
  });

  it('ignores repeat clicks while busy', async () => {
    let release!: () => void;
    mockCheck.mockResolvedValue({
      downloadAndInstall: () => new Promise<void>((r) => (release = r)),
    });
    const first = useAppUpdateStore.getState().installUpdate();
    await vi.waitFor(() => expect(useAppUpdateStore.getState().phase).toBe('downloading'));
    await useAppUpdateStore.getState().installUpdate();
    expect(mockCheck).toHaveBeenCalledOnce();
    release();
    await first;
  });
});
