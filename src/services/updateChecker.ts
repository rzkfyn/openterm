import { APP_VERSION } from '../version';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

const GITHUB_API_LATEST = 'https://api.github.com/repos/rzkfyn/openterm/releases/latest';
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
