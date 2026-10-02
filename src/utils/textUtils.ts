/**
 * Utilities for filename splitting and middle truncation.
 */

const COMPOUND_EXTENSIONS = [
  '.tar.gz',
  '.tar.bz2',
  '.tar.xz',
  '.tar.zst',
  '.d.ts',
  '.spec.ts',
  '.spec.tsx',
  '.test.ts',
  '.test.tsx',
  '.spec.js',
  '.test.js',
];

/**
 * Splits a filename into base name and extension.
 * Recognizes compound extensions (.tar.gz, .d.ts) and ignores leading dotfiles (.gitignore).
 */
export function splitFileName(fileName: string): { base: string; ext: string } {
  if (!fileName) return { base: '', ext: '' };

  const lower = fileName.toLowerCase();
  for (const compound of COMPOUND_EXTENSIONS) {
    if (lower.endsWith(compound) && fileName.length > compound.length) {
      return {
        base: fileName.slice(0, fileName.length - compound.length),
        ext: fileName.slice(fileName.length - compound.length),
      };
    }
  }

  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) {
    return { base: fileName, ext: '' };
  }

  return {
    base: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot),
  };
}

/**
 * Formats a long string with middle truncation ("beginning...ending"),
 * preserving suffix/extension for clear readability.
 */
export function truncateMiddle(name: string, maxLength: number = 32): string {
  if (!name || name.length <= maxLength) return name;
  if (maxLength <= 5) return name.slice(0, maxLength);

  const { base, ext } = splitFileName(name);
  const extLen = ext.length;

  // If extension takes up too much of maxLength, do plain middle truncation
  if (extLen >= maxLength - 4) {
    const keepStart = Math.ceil((maxLength - 3) / 2);
    const keepEnd = Math.floor((maxLength - 3) / 2);
    return `${name.slice(0, keepStart)}...${name.slice(name.length - keepEnd)}`;
  }

  const availableForBase = maxLength - extLen - 3; // 3 for "..."
  const startChars = Math.ceil(availableForBase * 0.6);
  const endChars = Math.floor(availableForBase * 0.4);

  return `${base.slice(0, startChars)}...${base.slice(base.length - endChars)}${ext}`;
}
