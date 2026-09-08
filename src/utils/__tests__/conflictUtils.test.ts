import { describe, it, expect, vi } from 'vitest';
import { shouldTransferOnConflict, resolveDestinationPath } from '../conflictUtils';

describe('conflictUtils', () => {
  const older = { size: 100, modified: 1000 };
  const newer = { size: 100, modified: 2000 };
  const diffSize = { size: 250, modified: 1000 };

  it('handles skip action', () => {
    expect(shouldTransferOnConflict('skip', newer, older)).toBe(false);
  });

  it('handles overwrite action', () => {
    expect(shouldTransferOnConflict('overwrite', older, newer)).toBe(true);
  });

  it('handles overwrite_newer action correctly', () => {
    // Source newer than dest -> true
    expect(shouldTransferOnConflict('overwrite_newer', newer, older)).toBe(true);
    // Source older than dest -> false
    expect(shouldTransferOnConflict('overwrite_newer', older, newer)).toBe(false);
    // Equal timestamp -> false
    expect(shouldTransferOnConflict('overwrite_newer', older, older)).toBe(false);
  });

  it('handles overwrite_size action correctly', () => {
    // Different size -> true
    expect(shouldTransferOnConflict('overwrite_size', diffSize, older)).toBe(true);
    // Same size -> false
    expect(shouldTransferOnConflict('overwrite_size', older, newer)).toBe(false);
  });

  it('resolves destination path for overwrite and skip', async () => {
    const mockCheck = vi.fn().mockResolvedValue(true);
    expect(await resolveDestinationPath('/path/file.txt', 'skip', mockCheck)).toBeNull();
    expect(await resolveDestinationPath('/path/file.txt', 'overwrite', mockCheck)).toBe('/path/file.txt');
  });

  it('resolves destination path by incrementing duplicate index for rename', async () => {
    // file.txt exists, file (1).txt exists, file (2).txt does not exist
    const mockCheck = vi
      .fn()
      .mockImplementation(async (p: string) => {
        if (p === '/data/file.txt') return true;
        if (p === '/data/file (1).txt') return true;
        return false;
      });

    const result = await resolveDestinationPath('/data/file.txt', 'rename', mockCheck);
    expect(result).toBe('/data/file (2).txt');
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });
});
