import { describe, it, expect } from 'vitest';
import { shouldTransferOnConflict } from '../../../utils/conflictUtils';
import { generateIndexedPath } from '../../../utils/pathUtils';

describe('Transfer Conflict & Overwrite Logic', () => {
  it('correctly decides overwrite when source is newer', () => {
    const src = { size: 500, modified: 1700000100 };
    const dest = { size: 500, modified: 1700000000 };

    expect(shouldTransferOnConflict('overwrite_newer', src, dest)).toBe(true);
    expect(shouldTransferOnConflict('overwrite_newer', dest, src)).toBe(false);
  });

  it('correctly decides overwrite when file size differs', () => {
    const src = { size: 1024, modified: 1700000000 };
    const dest = { size: 2048, modified: 1700000000 };

    expect(shouldTransferOnConflict('overwrite_size', src, dest)).toBe(true);
    expect(shouldTransferOnConflict('overwrite_size', src, { size: 1024, modified: 1700000000 })).toBe(false);
  });

  it('generates sequential indexed names on conflicts', () => {
    let candidate = '/home/user/archive.tar.gz';
    candidate = generateIndexedPath(candidate);
    expect(candidate).toBe('/home/user/archive (1).tar.gz');

    candidate = generateIndexedPath(candidate);
    expect(candidate).toBe('/home/user/archive (2).tar.gz');
  });
});
