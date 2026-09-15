import { describe, it, expect } from 'vitest';

describe('Terminal search validation and query handling', () => {
  it('validates regex syntax correctly', () => {
    const isValidRegex = (pattern: string) => {
      try {
        new RegExp(pattern);
        return true;
      } catch {
        return false;
      }
    };

    expect(isValidRegex('hello')).toBe(true);
    expect(isValidRegex('[a-z]+')).toBe(true);
    expect(isValidRegex('[a-z')).toBe(false);
    expect(isValidRegex('(')).toBe(false);
    expect(isValidRegex('*abc')).toBe(false);
  });

  it('allows whitespace queries for alignment and space matching', () => {
    const shouldSearch = (query: string) => query.length > 0;

    expect(shouldSearch('   ')).toBe(true);
    expect(shouldSearch('\t')).toBe(true);
    expect(shouldSearch('')).toBe(false);
  });

  it('ignores global shortcuts when input or textarea is active', () => {
    const isTargetEditable = (tag: string, contentEditable = false) => {
      return tag === 'INPUT' || tag === 'TEXTAREA' || contentEditable;
    };

    expect(isTargetEditable('INPUT')).toBe(true);
    expect(isTargetEditable('TEXTAREA')).toBe(true);
    expect(isTargetEditable('DIV', true)).toBe(true);
    expect(isTargetEditable('DIV', false)).toBe(false);
  });
});
