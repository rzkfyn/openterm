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
 * Normalizes all Windows backslashes to forward slashes.
 */
export function joinRemotePath(base: string, ...parts: string[]): string {
  const normBase = (base || '').replace(/\\/g, '/');
  if (!normBase || normBase === '.') {
    const joined = parts
      .map((p) => p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, ''))
      .filter(Boolean)
      .join('/');
    return joined || '.';
  }

  let current = normBase === '/' ? '' : normBase.replace(/\/+$/, '');
  for (const part of parts) {
    if (!part) continue;
    const cleanPart = part
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    if (cleanPart) {
      current = `${current}/${cleanPart}`;
    }
  }
  return current || '/';
}

/**
 * Appends an incremented index to a filename before its extension.
 * e.g., "file.txt" -> "file (1).txt", "file (1).txt" -> "file (2).txt"
 */
export function generateIndexedPath(fullPath: string): string {
  const isWindows = fullPath.includes('\\');
  const sep = isWindows ? '\\' : '/';
  const parts = fullPath.split(/[/\\]/);
  const fileName = parts.pop() || '';
  const dir = parts.join(sep);

  // Check for common compound extensions (.tar.gz, .tar.bz2, .tar.xz)
  let dotIdx = fileName.lastIndexOf('.');
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.bz2') || lower.endsWith('.tar.xz')) {
    dotIdx = fileName.length - 7;
  }

  let baseName = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.substring(dotIdx) : '';

  const match = baseName.match(/^(.*) \((\d+)\)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10) + 1;
    baseName = `${prefix} (${num})`;
  } else {
    baseName = `${baseName} (1)`;
  }

  const newFileName = `${baseName}${ext}`;
  return dir ? `${dir}${sep}${newFileName}` : newFileName;
}
