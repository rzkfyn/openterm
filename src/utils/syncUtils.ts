export function parseOsc7Path(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let pathPart = trimmed;
  if (pathPart.startsWith('file://')) {
    const withoutScheme = pathPart.slice(7);
    const firstSlash = withoutScheme.indexOf('/');
    if (firstSlash !== -1) {
      pathPart = withoutScheme.slice(firstSlash);
    } else {
      return null;
    }
  }

  if (!pathPart.startsWith('/')) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(pathPart);
    return decoded || null;
  } catch {
    return pathPart || null;
  }
}

export function formatSafeCdCommand(remotePath: string): string {
  const sanitized = remotePath.replace(/'/g, "'\\''");
  return `cd -- '${sanitized}'\r`;
}

export class SyncCoordinator {
  private lastSyncedPath: string = '';
  private lastSyncedTime: number = 0;
  private lastSyncSource: 'terminal' | 'sftp' | null = null;

  public shouldSync(
    targetPath: string,
    source: 'terminal' | 'sftp',
    now: number = Date.now()
  ): boolean {
    if (!targetPath) return false;
    const cleanTarget = targetPath.trim().replace(/\/+$/, '') || '/';
    const cleanLast = this.lastSyncedPath.trim().replace(/\/+$/, '') || '/';

    // Discard if same path was synced recently (within 2 seconds)
    if (cleanTarget === cleanLast && now - this.lastSyncedTime < 2000) {
      return false;
    }

    this.lastSyncedPath = cleanTarget;
    this.lastSyncedTime = now;
    this.lastSyncSource = source;
    return true;
  }

  public recordSync(
    path: string,
    source: 'terminal' | 'sftp',
    now: number = Date.now()
  ): void {
    this.lastSyncedPath = path.trim().replace(/\/+$/, '') || '/';
    this.lastSyncedTime = now;
    this.lastSyncSource = source;
  }

  public getLastSync(): {
    path: string;
    time: number;
    source: 'terminal' | 'sftp' | null;
  } {
    return {
      path: this.lastSyncedPath,
      time: this.lastSyncedTime,
      source: this.lastSyncSource,
    };
  }

  public reset(): void {
    this.lastSyncedPath = '';
    this.lastSyncedTime = 0;
    this.lastSyncSource = null;
  }
}

export const syncCoordinator = new SyncCoordinator();
