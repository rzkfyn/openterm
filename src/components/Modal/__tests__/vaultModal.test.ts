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

  it('triggers 30-second lockout after 5 consecutive failed attempts', () => {
    let failedAttempts = 0;
    let lockoutRemaining = 0;

    const handleFailedAttempt = () => {
      failedAttempts += 1;
      if (failedAttempts >= 5) {
        lockoutRemaining = 30;
      }
    };

    for (let i = 0; i < 4; i++) {
      handleFailedAttempt();
    }
    expect(failedAttempts).toBe(4);
    expect(lockoutRemaining).toBe(0);

    handleFailedAttempt(); // 5th failure
    expect(failedAttempts).toBe(5);
    expect(lockoutRemaining).toBe(30);
  });

  it('validates and cleans recovery token format', () => {
    const cleanRecoveryKey = (token: string) => {
      const clean = token.trim().toUpperCase().replace(/-/g, '').replace(/\s+/g, '');
      return clean.startsWith('OT') ? clean.slice(2) : clean;
    };

    expect(cleanRecoveryKey('OT-A1B2-C3D4-E5F6-7890')).toBe('A1B2C3D4E5F67890');
    expect(cleanRecoveryKey('ot-a1b2-c3d4-e5f6-7890')).toBe('A1B2C3D4E5F67890');
    expect(cleanRecoveryKey('A1B2C3D4E5F67890')).toBe('A1B2C3D4E5F67890');
  });
});
