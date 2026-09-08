import { describe, it, expect } from 'vitest';
import { FileEntry } from '../../../types';

describe('FilePane Search & Filter Logic', () => {
  const mockEntries: FileEntry[] = [
    { name: 'config.json', path: '/app/config.json', size: 1024, isDir: false, isSymlink: false },
    { name: 'src', path: '/app/src', size: 4096, isDir: true, isSymlink: false },
    { name: 'server.ts', path: '/app/server.ts', size: 2048, isDir: false, isSymlink: false },
    { name: 'README.md', path: '/app/README.md', size: 512, isDir: false, isSymlink: false },
    { name: 'docker-compose.yml', path: '/app/docker-compose.yml', size: 1200, isDir: false, isSymlink: false },
  ];

  const filterFiles = (entries: FileEntry[], query: string) => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase().trim();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  };

  it('returns all entries when search query is empty', () => {
    expect(filterFiles(mockEntries, '')).toEqual(mockEntries);
    expect(filterFiles(mockEntries, '   ')).toEqual(mockEntries);
  });

  it('filters entries by substring matching (case-insensitive)', () => {
    const results = filterFiles(mockEntries, 'json');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('config.json');

    const readmes = filterFiles(mockEntries, 'readme');
    expect(readmes).toHaveLength(1);
    expect(readmes[0].name).toBe('README.md');
  });

  it('matches multiple items by extension or common substring', () => {
    const results = filterFiles(mockEntries, '.');
    expect(results).toHaveLength(4); // config.json, server.ts, README.md, docker-compose.yml
  });

  it('preserves directory precedence when sorting filtered entries', () => {
    const entriesWithDir: FileEntry[] = [
      { name: 'test_file.txt', path: '/test_file.txt', size: 10, isDir: false, isSymlink: false },
      { name: 'test_dir', path: '/test_dir', size: 4096, isDir: true, isSymlink: false },
    ];
    const filtered = filterFiles(entriesWithDir, 'test');
    const sorted = [...filtered].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    expect(sorted[0].name).toBe('test_dir');
    expect(sorted[1].name).toBe('test_file.txt');
  });
});
