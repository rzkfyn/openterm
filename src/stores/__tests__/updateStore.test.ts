import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUpdateStore } from '../updateStore';
import * as updateChecker from '../../services/updateChecker';
import type { ReleaseItem } from '../../services/updateChecker';

vi.mock('../../services/updateChecker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/updateChecker')>();
  return {
    ...actual,
    fetchReleasesList: vi.fn(),
    checkLatestRelease: vi.fn(),
  };
});

const mockReleases: ReleaseItem[] = [
  {
    id: 101,
    tagName: 'v0.7.2',
    name: 'v0.7.2 - Terminal Sync & UI',
    publishedAt: '2026-09-18T12:00:00Z',
    body: '## New Features\n- Added changelog modal',
    htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2',
    isPrerelease: false,
  },
  {
    id: 100,
    tagName: 'v0.7.1',
    name: 'v0.7.1 - Bug Fixes',
    publishedAt: '2026-09-15T12:00:00Z',
    body: '## Bug Fixes\n- Fixed crash',
    htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.1',
    isPrerelease: false,
  },
];

describe('useUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      currentVersion: '0.7.1',
      latestVersion: null,
      releaseUrl: null,
      hasUpdate: false,
      isChecking: false,
      dismissed: false,
      checkStatus: 'idle',
      releases: [],
      isLoadingReleases: false,
      isChangelogOpen: false,
      selectedReleaseTag: null,
    });
  });

  describe('Initial State', () => {
    it('has correct changelog initial state', () => {
      const state = useUpdateStore.getState();
      expect(state.isChangelogOpen).toBe(false);
      expect(state.releases).toEqual([]);
      expect(state.selectedReleaseTag).toBeNull();
      expect(state.isLoadingReleases).toBe(false);
    });
  });

  describe('openChangelog', () => {
    it('sets isChangelogOpen to true and fetches releases, selecting first tag when none provided', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue(mockReleases);

      useUpdateStore.getState().openChangelog();

      expect(useUpdateStore.getState().isChangelogOpen).toBe(true);
      expect(updateChecker.fetchReleasesList).toHaveBeenCalledTimes(1);

      // Wait for release fetch to settle
      await vi.waitFor(() => {
        expect(useUpdateStore.getState().isLoadingReleases).toBe(false);
        expect(useUpdateStore.getState().releases).toEqual(mockReleases);
      });

      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.2');
    });

    it('sets selectedReleaseTag when initialTag is provided', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue(mockReleases);

      useUpdateStore.getState().openChangelog('v0.7.1');

      expect(useUpdateStore.getState().isChangelogOpen).toBe(true);
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.1');

      await vi.waitFor(() => {
        expect(useUpdateStore.getState().isLoadingReleases).toBe(false);
      });

      // Does not overwrite explicitly set initialTag with first release tag
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.1');
    });

    it('resets selectedReleaseTag to null when openChangelog() is called without argument', () => {
      useUpdateStore.setState({ selectedReleaseTag: 'v0.7.1' });
      useUpdateStore.getState().openChangelog();
      expect(useUpdateStore.getState().isChangelogOpen).toBe(true);
      expect(useUpdateStore.getState().selectedReleaseTag).toBeNull();
    });
  });
  describe('closeChangelog', () => {
    it('sets isChangelogOpen to false', () => {
      useUpdateStore.setState({ isChangelogOpen: true });
      useUpdateStore.getState().closeChangelog();
      expect(useUpdateStore.getState().isChangelogOpen).toBe(false);
    });
  });

  describe('selectRelease', () => {
    it('updates selectedReleaseTag', () => {
      useUpdateStore.getState().selectRelease('v0.7.0');
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.0');

      useUpdateStore.getState().selectRelease('v0.7.2');
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.2');
    });
  });

  describe('fetchReleases', () => {
    it('populates releases and handles loading state', async () => {
      let resolvePromise: (value: ReleaseItem[]) => void = () => {};
      const pendingPromise = new Promise<ReleaseItem[]>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(updateChecker.fetchReleasesList).mockReturnValue(pendingPromise);

      const fetchPromise = useUpdateStore.getState().fetchReleases(true);

      // In-flight check
      expect(useUpdateStore.getState().isLoadingReleases).toBe(true);
      expect(updateChecker.fetchReleasesList).toHaveBeenCalledWith(true);

      resolvePromise(mockReleases);
      await fetchPromise;

      expect(useUpdateStore.getState().isLoadingReleases).toBe(false);
      expect(useUpdateStore.getState().releases).toEqual(mockReleases);
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.2');
    });

    it('preserves existing selectedReleaseTag if already set', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue(mockReleases);
      useUpdateStore.setState({ selectedReleaseTag: 'v0.7.1' });

      await useUpdateStore.getState().fetchReleases();

      expect(useUpdateStore.getState().releases).toEqual(mockReleases);
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.1');
    });

    it('matches and normalizes tag without "v" prefix to release tagName', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue(mockReleases);
      useUpdateStore.setState({ selectedReleaseTag: '0.7.1' });

      await useUpdateStore.getState().fetchReleases();

      expect(useUpdateStore.getState().releases).toEqual(mockReleases);
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.1');
    });

    it('defaults to releases[0].tagName when selectedReleaseTag matches no release', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue(mockReleases);
      useUpdateStore.setState({ selectedReleaseTag: '9.9.9' });

      await useUpdateStore.getState().fetchReleases();

      expect(useUpdateStore.getState().releases).toEqual(mockReleases);
      expect(useUpdateStore.getState().selectedReleaseTag).toBe('v0.7.2');
    });

    it('keeps selectedReleaseTag null if releases list is empty', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockResolvedValue([]);

      await useUpdateStore.getState().fetchReleases();

      expect(useUpdateStore.getState().releases).toEqual([]);
      expect(useUpdateStore.getState().selectedReleaseTag).toBeNull();
    });

    it('recovers gracefully and resets loading state when fetchReleasesList throws', async () => {
      vi.mocked(updateChecker.fetchReleasesList).mockRejectedValue(new Error('Network error'));

      await useUpdateStore.getState().fetchReleases();

      expect(useUpdateStore.getState().isLoadingReleases).toBe(false);
      expect(useUpdateStore.getState().releases).toEqual([]);
    });
  });

  describe('Existing actions', () => {
    it('sets dismissed to true via dismissUpdate', () => {
      expect(useUpdateStore.getState().dismissed).toBe(false);
      useUpdateStore.getState().dismissUpdate();
      expect(useUpdateStore.getState().dismissed).toBe(true);
    });
  });
});
