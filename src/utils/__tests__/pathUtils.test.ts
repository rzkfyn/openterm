import { describe, it, expect } from 'vitest';
import { getBasename, joinLocalPath, joinRemotePath, generateIndexedPath } from '../pathUtils';

describe('pathUtils', () => {
  it('extracts basename correctly for Windows paths', () => {
    expect(getBasename('C:\\Users\\tester\\file.txt')).toBe('file.txt');
    expect(getBasename('C:\\Users\\tester\\folder\\')).toBe('folder');
    expect(getBasename('\\\\?\\C:\\Users\\tester\\nested\\image.png')).toBe('image.png');
  });

  it('extracts basename correctly for POSIX paths', () => {
    expect(getBasename('/var/log/nginx.log')).toBe('nginx.log');
    expect(getBasename('/home/user/myfolder/')).toBe('myfolder');
    expect(getBasename('relative/path/test.tar.gz')).toBe('test.tar.gz');
  });

  it('joins local Windows paths correctly', () => {
    expect(joinLocalPath('C:\\Users\\tester', 'file.txt')).toBe('C:\\Users\\tester\\file.txt');
    expect(joinLocalPath('C:\\Users\\tester\\', 'nested', 'file.txt')).toBe('C:\\Users\\tester\\nested\\file.txt');
  });

  it('joins local POSIX paths correctly', () => {
    expect(joinLocalPath('/home/tester', 'file.txt')).toBe('/home/tester/file.txt');
  });

  it('joins remote POSIX SFTP paths correctly', () => {
    expect(joinRemotePath('/var/www', 'index.html')).toBe('/var/www/index.html');
    expect(joinRemotePath('.', 'test.txt')).toBe('test.txt');
    expect(joinRemotePath('/var/www/', 'sub', 'file.txt')).toBe('/var/www/sub/file.txt');
  });

  it('generates indexed paths for duplicate files', () => {
    expect(generateIndexedPath('/var/www/file.txt')).toBe('/var/www/file (1).txt');
    expect(generateIndexedPath('/var/www/file (1).txt')).toBe('/var/www/file (2).txt');
    expect(generateIndexedPath('C:\\Docs\\notes.md')).toBe('C:\\Docs\\notes (1).md');
    expect(generateIndexedPath('Dockerfile')).toBe('Dockerfile (1)');
  });
});
