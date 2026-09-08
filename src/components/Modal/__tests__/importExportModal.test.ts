import { describe, it, expect } from 'vitest';

describe('Import Collision Detection & Resolution', () => {
  const existing = [
    { host: '127.0.0.1', port: 22, username: 'root', name: 'Local Root' },
    { host: 'app.internal', port: 2222, username: 'deploy', name: 'Internal App' },
  ];

  const isDuplicate = (item: { host: string; port: number; username: string }) =>
    existing.some((e) => e.host === item.host && e.port === item.port && e.username === item.username);

  const resolveDuplicateName = (name: string, existingNames: string[]) => {
    let candidate = name;
    let counter = 1;
    while (existingNames.includes(candidate)) {
      candidate = `${name} (${counter})`;
      counter++;
    }
    return candidate;
  };

  it('identifies exact matches as duplicate', () => {
    expect(isDuplicate({ host: '127.0.0.1', port: 22, username: 'root' })).toBe(true);
    expect(isDuplicate({ host: '127.0.0.1', port: 2222, username: 'root' })).toBe(false);
    expect(isDuplicate({ host: 'new.domain', port: 22, username: 'root' })).toBe(false);
  });

  it('generates non-colliding names with incrementing suffix', () => {
    const names = ['Local Root', 'Local Root (1)'];
    expect(resolveDuplicateName('Local Root', names)).toBe('Local Root (2)');
    expect(resolveDuplicateName('New Server', names)).toBe('New Server');
  });
});
