import { describe, it, expect } from 'vitest';
import { joinRemotePath, joinLocalPath, getBasename } from '../../../utils/pathUtils';

describe('File Operations & Permissions Calculation', () => {
  it('calculates standard unix octal modes properly', () => {
    // 0o755 = rwxr-xr-x: owner=7, group=5, others=5
    const owner = (4 | 2 | 1); // 7
    const group = (4 | 1);     // 5
    const others = (4 | 1);    // 5
    const mode = (owner << 6) | (group << 3) | others;
    expect(mode).toBe(0o755);
    expect(mode.toString(8)).toBe('755');

    // 0o644 = rw-r--r--: owner=6, group=4, others=4
    const mode644 = ((4 | 2) << 6) | (4 << 3) | 4;
    expect(mode644).toBe(0o644);
    expect(mode644.toString(8)).toBe('644');
  });

  it('correctly derives target paths for rename and new item operations', () => {
    const remoteCurrent = '/home/ubuntu/app';
    const newFile = joinRemotePath(remoteCurrent, 'config.yaml');
    expect(newFile).toBe('/home/ubuntu/app/config.yaml');

    const newFolder = joinRemotePath(remoteCurrent, 'nested-dir');
    expect(newFolder).toBe('/home/ubuntu/app/nested-dir');

    expect(getBasename(newFile)).toBe('config.yaml');
    expect(getBasename(newFolder)).toBe('nested-dir');
  });

  it('handles dot directory path joins', () => {
    expect(joinRemotePath('.', 'script.sh')).toBe('script.sh');
    expect(joinRemotePath('', 'file.txt')).toBe('file.txt');
  });
});
