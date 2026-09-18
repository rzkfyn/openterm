import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseSemver,
  isNewerVersion,
  checkLatestRelease,
  fetchReleasesList,
  calculateVersionDistance,
  type ReleaseItem,
} from '../updateChecker';

describe('updateChecker', () => {
  const storageMap = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('parseSemver', () => {
    it('parses standard semver strings', () => {
      expect(parseSemver('0.5.1')).toEqual([0, 5, 1]);
      expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
      expect(parseSemver('V2.0.10')).toEqual([2, 0, 10]);
    });

    it('parses semver with prerelease suffix', () => {
      expect(parseSemver('v0.5.1-beta.1')).toEqual([0, 5, 1]);
      expect(parseSemver('1.0.0-rc1')).toEqual([1, 0, 0]);
    });

    it('returns null for invalid versions', () => {
      expect(parseSemver('invalid')).toBeNull();
      expect(parseSemver('')).toBeNull();
      expect(parseSemver('abc.def.ghi')).toBeNull();
    });
  });

  describe('isNewerVersion', () => {
    it('detects patch increments', () => {
      expect(isNewerVersion('0.5.2', '0.5.1')).toBe(true);
      expect(isNewerVersion('v0.5.2', '0.5.1')).toBe(true);
      expect(isNewerVersion('0.5.1', '0.5.2')).toBe(false);
    });

    it('detects minor increments', () => {
      expect(isNewerVersion('0.6.0', '0.5.9')).toBe(true);
      expect(isNewerVersion('0.5.0', '0.6.0')).toBe(false);
    });

    it('detects major increments', () => {
      expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
      expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
    });

    it('returns false for identical versions', () => {
      expect(isNewerVersion('0.5.1', '0.5.1')).toBe(false);
      expect(isNewerVersion('v0.5.1', '0.5.1')).toBe(false);
      expect(isNewerVersion('0.5.1', 'v0.5.1')).toBe(false);
    });

    it('returns false for invalid versions', () => {
      expect(isNewerVersion('bad', '0.5.1')).toBe(false);
      expect(isNewerVersion('0.5.1', 'bad')).toBe(false);
    });
  });

  describe('checkLatestRelease', () => {
    it('fetches latest release and returns update info', async () => {
      const mockResponse = {
        tag_name: 'v0.6.0',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.6.0',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await checkLatestRelease(true, '0.5.1');
      expect(res).not.toBeNull();
      expect(res?.hasUpdate).toBe(true);
      expect(res?.latestVersion).toBe('0.6.0');
      expect(res?.releaseUrl).toBe('https://github.com/rzkfyn/openterm/releases/tag/v0.6.0');
    });

    it('identifies when current version is up to date', async () => {
      const mockResponse = {
        tag_name: 'v0.5.1',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.5.1',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await checkLatestRelease(true, '0.5.1');
      expect(res).not.toBeNull();
      expect(res?.hasUpdate).toBe(false);
      expect(res?.latestVersion).toBe('0.5.1');
    });

    it('fails gracefully on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const res = await checkLatestRelease(true, '0.5.1');
      expect(res).toBeNull();
    });

    it('invalidates stale cache when current app version changes', async () => {
      localStorage.setItem('openterm_last_update_check', Date.now().toString());
      localStorage.setItem('openterm_cached_update_info', JSON.stringify({
        hasUpdate: true,
        currentVersion: '0.5.0',
        latestVersion: '0.5.1',
        releaseUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.5.1',
      }));

      const mockResponse = {
        tag_name: 'v0.5.1',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.5.1',
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await checkLatestRelease(false, '0.5.1');
      expect(res).not.toBeNull();
      expect(res?.hasUpdate).toBe(false);
      expect(res?.currentVersion).toBe('0.5.1');
    });
  });

  describe('calculateVersionDistance', () => {
    const sampleReleases: ReleaseItem[] = [
      {
        id: 3,
        tagName: 'v0.7.2',
        name: 'v0.7.2 - Release',
        publishedAt: '2026-09-18T12:00:00Z',
        body: 'Notes for 0.7.2',
        htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2',
        isPrerelease: false,
      },
      {
        id: 2,
        tagName: 'v0.7.1',
        name: 'v0.7.1 - Release',
        publishedAt: '2026-09-10T12:00:00Z',
        body: 'Notes for 0.7.1',
        htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.1',
        isPrerelease: false,
      },
      {
        id: 1,
        tagName: 'v0.7.0',
        name: 'v0.7.0 - Release',
        publishedAt: '2026-09-01T12:00:00Z',
        body: 'Notes for 0.7.0',
        htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.0',
        isPrerelease: false,
      },
    ];

    it('returns isLatest true when releases list is empty', () => {
      const res = calculateVersionDistance([], '0.7.0');
      expect(res).toEqual({
        isLatest: true,
        behindCount: 0,
        latestVersion: '0.7.0',
      });
    });

    it('strips leading v from currentVersion when releases list is empty', () => {
      const res = calculateVersionDistance([], 'v0.7.0');
      expect(res).toEqual({
        isLatest: true,
        behindCount: 0,
        latestVersion: '0.7.0',
      });
    });

    it('returns isLatest true and behindCount 0 when on latest version', () => {
      const res = calculateVersionDistance(sampleReleases, '0.7.2');
      expect(res).toEqual({
        isLatest: true,
        behindCount: 0,
        latestVersion: '0.7.2',
      });
    });

    it('computes behindCount correctly when multiple versions behind', () => {
      const res = calculateVersionDistance(sampleReleases, 'v0.7.0');
      expect(res).toEqual({
        isLatest: false,
        behindCount: 2,
        latestVersion: '0.7.2',
      });
    });

    it('computes behindCount 1 when 1 version behind', () => {
      const res = calculateVersionDistance(sampleReleases, '0.7.1');
      expect(res).toEqual({
        isLatest: false,
        behindCount: 1,
        latestVersion: '0.7.2',
      });
    });

    it('returns isLatest true when current version is ahead of latest release', () => {
      const res = calculateVersionDistance(sampleReleases, '0.8.0');
      expect(res).toEqual({
        isLatest: true,
        behindCount: 0,
        latestVersion: '0.7.2',
      });
    });

    it('ignores prereleases when stable releases exist', () => {
      const releasesWithPrerelease: ReleaseItem[] = [
        {
          id: 4,
          tagName: 'v0.8.0-beta.1',
          name: 'v0.8.0 Beta',
          publishedAt: '2026-09-20T12:00:00Z',
          body: 'Beta notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.8.0-beta.1',
          isPrerelease: true,
        },
        ...sampleReleases,
      ];

      const res = calculateVersionDistance(releasesWithPrerelease, '0.7.1');
      expect(res).toEqual({
        isLatest: false,
        behindCount: 1,
        latestVersion: '0.7.2',
      });
    });

    it('falls back to prerelease if only prereleases exist', () => {
      const onlyPrereleases: ReleaseItem[] = [
        {
          id: 2,
          tagName: 'v0.8.0-rc.2',
          name: 'v0.8.0 RC 2',
          publishedAt: '2026-09-20T12:00:00Z',
          body: 'RC notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.8.0-rc.2',
          isPrerelease: true,
        },
        {
          id: 1,
          tagName: 'v0.8.0-rc.1',
          name: 'v0.8.0 RC 1',
          publishedAt: '2026-09-10T12:00:00Z',
          body: 'RC notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.8.0-rc.1',
          isPrerelease: true,
        },
      ];

      const res = calculateVersionDistance(onlyPrereleases, '0.7.0');
      expect(res.isLatest).toBe(false);
      expect(res.behindCount).toBe(2);
      expect(res.latestVersion).toBe('0.8.0-rc.2');
    });

    it('handles releases with invalid semver tags gracefully', () => {
      const invalidTags: ReleaseItem[] = [
        {
          id: 99,
          tagName: 'nightly-build',
          name: 'Nightly',
          publishedAt: '2026-09-20T12:00:00Z',
          body: 'Nightly',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/nightly',
          isPrerelease: false,
        },
      ];

      const res = calculateVersionDistance(invalidTags, '0.7.0');
      expect(res).toEqual({
        isLatest: true,
        behindCount: 0,
        latestVersion: '0.7.0',
      });
    });
  });

  describe('fetchReleasesList', () => {
    const mockGithubReleases = [
      {
        id: 101,
        tag_name: 'v0.7.2',
        name: 'v0.7.2 - Terminal Sync & UI',
        published_at: '2026-09-18T10:00:00Z',
        body: 'Release notes for 0.7.2',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2',
        prerelease: false,
        draft: false,
      },
      {
        id: 100,
        tag_name: 'v0.7.2-draft',
        name: 'Draft release',
        published_at: '2026-09-17T10:00:00Z',
        body: 'Draft content',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2-draft',
        prerelease: false,
        draft: true,
      },
      {
        id: 99,
        tag_name: 'v0.7.1',
        name: 'v0.7.1 - Bug fixes',
        published_at: '2026-09-10T10:00:00Z',
        body: 'Release notes for 0.7.1',
        html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.1',
        prerelease: false,
        draft: false,
      },
    ];

    it('fetches releases from GitHub API and filters out drafts', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGithubReleases,
      } as Response);

      const releases = await fetchReleasesList(true);
      expect(releases).toHaveLength(2);
      expect(releases[0]).toEqual({
        id: 101,
        tagName: 'v0.7.2',
        name: 'v0.7.2 - Terminal Sync & UI',
        publishedAt: '2026-09-18T10:00:00Z',
        body: 'Release notes for 0.7.2',
        htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2',
        isPrerelease: false,
      });
      expect(releases[1].tagName).toBe('v0.7.1');
      expect(localStorage.getItem('openterm_cached_releases')).toBeTruthy();
      expect(localStorage.getItem('openterm_last_releases_check')).toBeTruthy();
    });

    it('returns cached releases when cache is fresh within 30 minutes', async () => {
      const cachedList: ReleaseItem[] = [
        {
          id: 50,
          tagName: 'v0.6.0',
          name: 'v0.6.0',
          publishedAt: '2026-08-01T00:00:00Z',
          body: 'Cached notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.6.0',
          isPrerelease: false,
        },
      ];

      localStorage.setItem('openterm_last_releases_check', Date.now().toString());
      localStorage.setItem('openterm_cached_releases', JSON.stringify(cachedList));

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const releases = await fetchReleasesList(false);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(releases).toEqual(cachedList);
    });

    it('refetches releases when force is true even if cache is fresh', async () => {
      const cachedList: ReleaseItem[] = [
        {
          id: 50,
          tagName: 'v0.6.0',
          name: 'v0.6.0',
          publishedAt: '2026-08-01T00:00:00Z',
          body: 'Cached notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.6.0',
          isPrerelease: false,
        },
      ];

      localStorage.setItem('openterm_last_releases_check', Date.now().toString());
      localStorage.setItem('openterm_cached_releases', JSON.stringify(cachedList));

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGithubReleases,
      } as Response);

      const releases = await fetchReleasesList(true);
      expect(releases).toHaveLength(2);
      expect(releases[0].tagName).toBe('v0.7.2');
    });

    it('falls back to cached releases on network error', async () => {
      const cachedList: ReleaseItem[] = [
        {
          id: 50,
          tagName: 'v0.6.0',
          name: 'v0.6.0',
          publishedAt: '2026-08-01T00:00:00Z',
          body: 'Cached notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.6.0',
          isPrerelease: false,
        },
      ];
      localStorage.setItem('openterm_cached_releases', JSON.stringify(cachedList));

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));

      const releases = await fetchReleasesList(true);
      expect(releases).toEqual(cachedList);
    });

    it('falls back to cached releases when API returns non-ok status', async () => {
      const cachedList: ReleaseItem[] = [
        {
          id: 50,
          tagName: 'v0.6.0',
          name: 'v0.6.0',
          publishedAt: '2026-08-01T00:00:00Z',
          body: 'Cached notes',
          htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.6.0',
          isPrerelease: false,
        },
      ];
      localStorage.setItem('openterm_cached_releases', JSON.stringify(cachedList));

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const releases = await fetchReleasesList(true);
      expect(releases).toEqual(cachedList);
    });

    it('returns empty array when network fails and no cached releases exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

      const releases = await fetchReleasesList(true);
      expect(releases).toEqual([]);
    });

    it('uses fallback name when release name is empty', async () => {
      const unnamedRelease = [
        {
          id: 102,
          tag_name: 'v0.7.3',
          name: '',
          published_at: '2026-09-19T10:00:00Z',
          body: 'Content',
          html_url: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.3',
          prerelease: false,
          draft: false,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => unnamedRelease,
      } as Response);

      const releases = await fetchReleasesList(true);
      expect(releases[0].name).toBe('v0.7.3');
    });
  });
});
