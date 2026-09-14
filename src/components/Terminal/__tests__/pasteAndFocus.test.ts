import { describe, it, expect, beforeEach } from 'vitest';
import { shouldProcessPaste, resetPasteTracker } from '../pasteTracker';

describe('Paste deduplication tracker', () => {
  beforeEach(() => {
    resetPasteTracker();
  });

  it('allows the first paste event', () => {
    expect(shouldProcessPaste('12345', 1000)).toBe(true);
  });

  it('blocks identical paste within 150ms debounce window', () => {
    expect(shouldProcessPaste('12345', 1000)).toBe(true);
    expect(shouldProcessPaste('12345', 1020)).toBe(false);
    expect(shouldProcessPaste('12345', 1140)).toBe(false);
  });

  it('allows identical paste after debounce window has elapsed', () => {
    expect(shouldProcessPaste('12345', 1000)).toBe(true);
    expect(shouldProcessPaste('12345', 1200)).toBe(true);
  });

  it('allows different text immediately', () => {
    expect(shouldProcessPaste('first', 1000)).toBe(true);
    expect(shouldProcessPaste('second', 1020)).toBe(true);
  });

  it('rejects empty text', () => {
    expect(shouldProcessPaste('', 1000)).toBe(false);
  });
});
