/**
 * Cross-platform path utilities for Windows, macOS, and Linux.
 */

/**
 * Extracts the file or folder name from any path (Windows '\' or POSIX '/').
 */
export function getBasename(filePath: string): string {
  if (!filePath) return '';
  const cleaned = filePath.replace(/^\\\\\?\\/, '').replace(/[/\\]+$/, '');
  const parts = cleaned.split(/[/\\]/).filter(Boolean);
  return parts.pop() || '';
}

/**
 * Joins a local path with one or more child components using appropriate separators.
 * Preserves Windows drive root (e.g. C:\) and UNC prefixes.
 */
export function joinLocalPath(base: string, ...parts: string[]): string {
  if (!base) return parts.join('/');
  const isWindows = /^[a-zA-Z]:|[/\\]/.test(base) && (base.includes('\\') || /^[a-zA-Z]:/.test(base));
  const sep = isWindows ? '\\' : '/';

  let current = base.replace(/[/\\]+$/, '');
  for (const part of parts) {
    if (!part) continue;
    const cleanPart = part.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (cleanPart) {
      current = `${current}${sep}${cleanPart}`;
    }
  }
  return current;
}

/**
 * Joins a remote POSIX SFTP path with one or more child components using '/'.
 */
export function joinRemotePath(base: string, ...parts: string[]): string {
  if (!base || base === '.') {
    const joined = parts.map((p) => p.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '')).filter(Boolean).join('/');
    return joined || '.';
  }

  let current = base.replace(/\/+$/, '');
  for (const part of parts) {
    if (!part) continue;
    const cleanPart = part.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (cleanPart) {
      current = `${current}/${cleanPart}`;
    }
  }
  return current;
}
