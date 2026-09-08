import { describe, it, expect } from 'vitest';
import { SavedConnection } from '../../../types';

export function groupConnectionsByFolder(connections: SavedConnection[]) {
  const groups: Record<string, SavedConnection[]> = {};
  for (const c of connections) {
    const f = c.folder?.trim() || 'Uncategorized';
    if (!groups[f]) groups[f] = [];
    groups[f].push(c);
  }

  // Sort: alphabetically, with 'Uncategorized' at the end if present
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return sortedKeys.map((key) => ({
    folder: key,
    connections: groups[key],
  }));
}

describe('Folder Grouping', () => {
  const sampleConns: SavedConnection[] = [
    {
      id: '1',
      name: 'Server A',
      host: '10.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password',
      folder: 'Production',
      createdAt: 100,
      updatedAt: 100,
    },
    {
      id: '2',
      name: 'Server B',
      host: '10.0.0.2',
      port: 22,
      username: 'root',
      authType: 'password',
      folder: 'App Test',
      createdAt: 200,
      updatedAt: 200,
    },
    {
      id: '3',
      name: 'Server C',
      host: '10.0.0.3',
      port: 22,
      username: 'root',
      authType: 'password',
      createdAt: 300,
      updatedAt: 300,
    },
  ];

  it('groups connections by folder and puts Uncategorized last', () => {
    const grouped = groupConnectionsByFolder(sampleConns);
    expect(grouped.length).toBe(3);
    expect(grouped[0].folder).toBe('App Test');
    expect(grouped[0].connections.length).toBe(1);
    expect(grouped[1].folder).toBe('Production');
    expect(grouped[2].folder).toBe('Uncategorized');
    expect(grouped[2].connections[0].name).toBe('Server C');
  });
});
