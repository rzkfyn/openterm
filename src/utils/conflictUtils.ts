import { ConflictAction } from '../types';
import { generateIndexedPath } from './pathUtils';

/**
 * Determines whether a file transfer should proceed based on conflict action and file stats.
 */
export function shouldTransferOnConflict(
  action: ConflictAction,
  sourceStat: { size: number; modified?: number },
  destStat: { size: number; modified?: number }
): boolean {
  switch (action) {
    case 'skip':
      return false;
    case 'overwrite':
    case 'rename':
      return true;
    case 'overwrite_newer': {
      const srcMod = sourceStat.modified ?? 0;
      const destMod = destStat.modified ?? 0;
      return srcMod > destMod;
    }
    case 'overwrite_size':
      return sourceStat.size !== destStat.size;
    default:
      return true;
  }
}

/**
 * Computes destination path taking into account conflict resolution (e.g. auto-rename if duplicate).
 */
export async function resolveDestinationPath(
  destPath: string,
  action: ConflictAction,
  checkExists: (path: string) => Promise<boolean>
): Promise<string | null> {
  if (action === 'skip') {
    return null;
  }

  if (action !== 'rename') {
    return destPath;
  }

  let candidate = destPath;
  let attempts = 0;
  while (attempts < 20) {
    const exists = await checkExists(candidate);
    if (!exists) {
      return candidate;
    }
    candidate = generateIndexedPath(candidate);
    attempts++;
  }

  return candidate;
}
