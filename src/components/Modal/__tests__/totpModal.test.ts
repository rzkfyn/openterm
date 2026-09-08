import { describe, it, expect } from 'vitest';

describe('TOTP 2FA & App Lock Validation', () => {
  it('validates 6-digit TOTP verification code input', () => {
    const isValidTotpCode = (code: string) => /^\d{6}$/.test(code.trim());
    expect(isValidTotpCode('123456')).toBe(true);
    expect(isValidTotpCode('000000')).toBe(true);
    expect(isValidTotpCode('12345')).toBe(false);
    expect(isValidTotpCode('1234567')).toBe(false);
    expect(isValidTotpCode('abcdef')).toBe(false);
    expect(isValidTotpCode('123 456')).toBe(false);
  });

  it('validates 8-character backup recovery codes with hyphen', () => {
    const isValidBackupCode = (code: string) => /^[A-Z2-7]{4}-[A-Z2-7]{4}$/i.test(code.trim());
    expect(isValidBackupCode('ABCD-EFGH')).toBe(true);
    expect(isValidBackupCode('abcd-efgh')).toBe(true);
    expect(isValidBackupCode('WXYZ-2345')).toBe(true);
    expect(isValidBackupCode('1234-5678')).toBe(false); // Base32 does not have 1 or 8
    expect(isValidBackupCode('ABCDEFGH')).toBe(false);
  });

  it('validates idle timeout boundaries', () => {
    const isValidIdleTimeout = (mins: number) => [0, 5, 15, 30, 60].includes(mins);
    expect(isValidIdleTimeout(0)).toBe(true);
    expect(isValidIdleTimeout(5)).toBe(true);
    expect(isValidIdleTimeout(15)).toBe(true);
    expect(isValidIdleTimeout(30)).toBe(true);
    expect(isValidIdleTimeout(60)).toBe(true);
    expect(isValidIdleTimeout(10)).toBe(false);
  });
});
