import { APP_VERSION } from '../version';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export interface ReleaseItem {
  id: number;
  tagName: string;        // e.g. "v0.7.2"
  name: string;           // e.g. "v0.7.2 - Terminal Sync & UI"
  publishedAt: string;    // ISO string
  body: string;           // Raw markdown text
  htmlUrl: string;        // Web release link
  isPrerelease: boolean;
}

export interface VersionDistanceResult {
  isLatest: boolean;
  behindCount: number;
  latestVersion: string;
}

const GITHUB_API_LATEST = 'https://api.github.com/repos/rzkfyn/openterm/releases/latest';
const GITHUB_API_RELEASES = 'https://api.github.com/repos/rzkfyn/openterm/releases?per_page=15';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function parseSemver(v: string): [number, number, number] | null {
  const clean = v.trim().replace(/^v/i, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

export function isNewerVersion(remote: string, current: string): boolean {
  const r = parseSemver(remote);
  const c = parseSemver(current);
  if (!r || !c) return false;
  if (r[0] > c[0]) return true;
  if (r[0] < c[0]) return false;
  if (r[1] > c[1]) return true;
  if (r[1] < c[1]) return false;
  return r[2] > c[2];
}

export async function checkLatestRelease(
  force = false,
  currentVersion = APP_VERSION
): Promise<UpdateInfo | null> {
  const lastCheck = typeof localStorage !== 'undefined' ? localStorage.getItem('openterm_last_update_check') : null;
  const now = Date.now();

  if (!force && lastCheck) {
    const elapsed = now - parseInt(lastCheck, 10);
    if (elapsed < CHECK_INTERVAL_MS) {
      const cached = localStorage.getItem('openterm_cached_update_info');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as UpdateInfo;
          // Invalidate cache if current app version changed
          if (parsed.currentVersion !== currentVersion) {
            localStorage.removeItem('openterm_cached_update_info');
            localStorage.removeItem('openterm_last_update_check');
          } else {
            // Re-verify hasUpdate strictly against currentVersion
            parsed.hasUpdate = isNewerVersion(parsed.latestVersion, currentVersion);
            return parsed;
          }
        } catch {
          // ignore cache parse error
        }
      }
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(GITHUB_API_LATEST, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const latestVersion = (data.tag_name || '').trim().replace(/^v/i, '');
    const releaseUrl = data.html_url || 'https://github.com/rzkfyn/openterm/releases';

    const hasUpdate = isNewerVersion(latestVersion, currentVersion);
    const info: UpdateInfo = {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl,
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('openterm_last_update_check', now.toString());
      localStorage.setItem('openterm_cached_update_info', JSON.stringify(info));
    }

    return info;
  } catch {
    // Network failure / offline / timeout — fail silently
    return null;
  }
}

function getCachedReleases(): ReleaseItem[] {
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem('openterm_cached_releases');
    if (cached) {
      try {
        return JSON.parse(cached) as ReleaseItem[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

export async function fetchReleasesList(force = false): Promise<ReleaseItem[]> {
  const now = Date.now();
  if (!force && typeof localStorage !== 'undefined') {
    const lastCheck = localStorage.getItem('openterm_last_releases_check');
    if (lastCheck) {
      const elapsed = now - parseInt(lastCheck, 10);
      if (elapsed < CHECK_INTERVAL_MS) {
        const cached = getCachedReleases();
        if (cached.length > 0) {
          return cached;
        }
      }
    }
  }

  try {
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(5000)
      : undefined;

    const res = await fetch(GITHUB_API_RELEASES, {
      signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return getCachedReleases();
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return getCachedReleases();
    }

    const releases: ReleaseItem[] = data
      .filter((item: any) => !item.draft)
      .map((item: any) => ({
        id: item.id,
        tagName: item.tag_name || '',
        name: item.name || item.tag_name || '',
        publishedAt: item.published_at || '',
        body: item.body || '',
        htmlUrl: item.html_url || '',
        isPrerelease: Boolean(item.prerelease),
      }));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('openterm_last_releases_check', now.toString());
      localStorage.setItem('openterm_cached_releases', JSON.stringify(releases));
    }

    return releases;
  } catch {
    return getCachedReleases();
  }
}

export function calculateVersionDistance(
  releases: ReleaseItem[],
  currentVersion: string
): VersionDistanceResult {
  const cleanCurrent = currentVersion.trim().replace(/^v/i, '');

  if (!releases || releases.length === 0) {
    return {
      isLatest: true,
      behindCount: 0,
      latestVersion: cleanCurrent,
    };
  }

  const validSemverReleases = releases.filter((r) => parseSemver(r.tagName) !== null);
  if (validSemverReleases.length === 0) {
    return {
      isLatest: true,
      behindCount: 0,
      latestVersion: cleanCurrent,
    };
  }

  const stableReleases = validSemverReleases.filter((r) => !r.isPrerelease);
  const pool = stableReleases.length > 0 ? stableReleases : validSemverReleases;

  let latestRelease = pool[0];
  for (let i = 1; i < pool.length; i++) {
    if (isNewerVersion(pool[i].tagName, latestRelease.tagName)) {
      latestRelease = pool[i];
    }
  }

  const latestVersion = latestRelease.tagName.trim().replace(/^v/i, '');
  const behindCount = pool.filter((r) => isNewerVersion(r.tagName, cleanCurrent)).length;
  const isLatest = behindCount === 0 || !isNewerVersion(latestVersion, cleanCurrent);

  return {
    isLatest,
    behindCount,
    latestVersion,
  };
}
