import { describe, it, expect } from 'vitest';
import { splitFileName, truncateMiddle } from '../textUtils';

describe('textUtils: splitFileName', () => {
  it('splits standard file extensions', () => {
    expect(splitFileName('main.ts')).toEqual({ base: 'main', ext: '.ts' });
    expect(splitFileName('photo.jpeg')).toEqual({ base: 'photo', ext: '.jpeg' });
  });

  it('recognizes compound extensions', () => {
    expect(splitFileName('archive.tar.gz')).toEqual({ base: 'archive', ext: '.tar.gz' });
    expect(splitFileName('types.d.ts')).toEqual({ base: 'types', ext: '.d.ts' });
    expect(splitFileName('Component.test.tsx')).toEqual({ base: 'Component', ext: '.test.tsx' });
  });

  it('handles dotfiles without extensions', () => {
    expect(splitFileName('.gitignore')).toEqual({ base: '.gitignore', ext: '' });
    expect(splitFileName('.env')).toEqual({ base: '.env', ext: '' });
  });

  it('handles files with no extension', () => {
    expect(splitFileName('Makefile')).toEqual({ base: 'Makefile', ext: '' });
    expect(splitFileName('LICENSE')).toEqual({ base: 'LICENSE', ext: '' });
  });
});

describe('textUtils: truncateMiddle', () => {
  it('leaves short filenames intact', () => {
    expect(truncateMiddle('app.js', 20)).toBe('app.js');
  });

  it('truncates middle and keeps compound extension intact', () => {
    const truncated = truncateMiddle('production-api-service-v2.4.1.tar.gz', 25);
    expect(truncated.endsWith('.tar.gz')).toBe(true);
    expect(truncated.includes('...')).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(25);
  });

  it('truncates middle for long filenames with standard extension', () => {
    const truncated = truncateMiddle('kubernetes-ingress-controller.yaml', 22);
    expect(truncated.endsWith('.yaml')).toBe(true);
    expect(truncated.includes('...')).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(22);
  });
});
