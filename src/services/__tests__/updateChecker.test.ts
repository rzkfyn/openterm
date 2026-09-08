import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseSemver, isNewerVersion, checkLatestRelease } from '../updateChecker';

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
  });
});
