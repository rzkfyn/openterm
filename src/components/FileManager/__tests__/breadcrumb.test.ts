import { describe, it, expect } from 'vitest';

function buildSubPaths(path: string): string[] {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.map((part, index) => {
    if (index === 0 && /^[A-Za-z]:$/.test(part)) {
      return part + '/';
    }
    const segments = parts.slice(0, index + 1);
    if (/^[A-Za-z]:$/.test(segments[0])) {
      return segments[0] + '/' + segments.slice(1).join('/');
    }
    return '/' + segments.join('/');
  });
}

function getParentPath(path: string): string {
  if (!path || path === '/' || path === '\\') return path;
  const norm = path.replace(/\\/g, '/');
  if (/^[A-Za-z]:\/?$/.test(norm)) return norm;
  return norm.substring(0, norm.lastIndexOf('/')) || '/';
}

describe('Breadcrumb path resolution', () => {
  it('handles Unix root and deep paths', () => {
    expect(buildSubPaths('/var/log/nginx')).toEqual([
      '/var',
      '/var/log',
      '/var/log/nginx',
    ]);
    expect(getParentPath('/var/log/nginx')).toBe('/var/log');
  });

  it('handles Windows drive paths without prepending unix slash', () => {
    expect(buildSubPaths('C:\\Users\\Admin')).toEqual([
      'C:/',
      'C:/Users',
      'C:/Users/Admin',
    ]);
    expect(getParentPath('C:/Users/Admin')).toBe('C:/Users');
    expect(getParentPath('C:/Users')).toBe('C:');
    expect(getParentPath('C:/')).toBe('C:/');
  });
});
