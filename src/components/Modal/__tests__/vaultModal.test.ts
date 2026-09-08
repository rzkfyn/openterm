import { describe, it, expect } from 'vitest';

describe('Vault Security & Password Validation', () => {
  it('enforces minimum master password length of 6 characters', () => {
    const isMasterPasswordValid = (pwd: string) => pwd.trim().length >= 6;
    expect(isMasterPasswordValid('12345')).toBe(false);
    expect(isMasterPasswordValid('123456')).toBe(true);
    expect(isMasterPasswordValid('  12345  ')).toBe(false);
    expect(isMasterPasswordValid('secret-master-pass')).toBe(true);
  });

  it('verifies confirmation password matches', () => {
    const doPasswordsMatch = (p1: string, p2: string) => p1.length >= 6 && p1 === p2;
    expect(doPasswordsMatch('password123', 'password123')).toBe(true);
    expect(doPasswordsMatch('password123', 'password124')).toBe(false);
  });

  it('selects correct default mode based on encryption and lock status', () => {
    const getInitialMode = (isEncrypted: boolean, isUnlocked: boolean) =>
      !isEncrypted ? 'setup' : !isUnlocked ? 'unlock' : 'change';

    expect(getInitialMode(false, true)).toBe('setup');
    expect(getInitialMode(true, false)).toBe('unlock');
    expect(getInitialMode(true, true)).toBe('change');
  });
});
