import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';

describe('2FA QR Code & URI Generation', () => {
  it('generates valid QR data URL from otpauth URI', async () => {
    const uri = 'otpauth://totp/OpenTerm:client?secret=JBSWY3DPEHPK3PXP&issuer=OpenTerm&algorithm=SHA1&digits=6&period=30';
    const dataUrl = await QRCode.toDataURL(uri, {
      margin: 1,
      width: 160,
    });

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it('validates 6-digit TOTP verification code input', () => {
    const isValidTotpCode = (code: string) => /^\d{6}$/.test(code.trim());
    expect(isValidTotpCode('123456')).toBe(true);
    expect(isValidTotpCode('000000')).toBe(true);
    expect(isValidTotpCode('12345')).toBe(false);
    expect(isValidTotpCode('1234567')).toBe(false);
    expect(isValidTotpCode('abcdef')).toBe(false);
  });

  it('validates 8-character backup recovery codes with hyphen', () => {
    const isValidBackupCode = (code: string) => /^[A-Z2-7]{4}-[A-Z2-7]{4}$/i.test(code.trim());
    expect(isValidBackupCode('ABCD-EFGH')).toBe(true);
    expect(isValidBackupCode('abcd-efgh')).toBe(true);
    expect(isValidBackupCode('WXYZ-2345')).toBe(true);
    expect(isValidBackupCode('1234-5678')).toBe(false);
  });

  it('validates idle timeout boundaries including 0 (disabled)', () => {
    const isValidIdleTimeout = (mins: number) => [0, 5, 15, 30, 60].includes(mins);
    expect(isValidIdleTimeout(0)).toBe(true);
    expect(isValidIdleTimeout(5)).toBe(true);
    expect(isValidIdleTimeout(15)).toBe(true);
    expect(isValidIdleTimeout(30)).toBe(true);
    expect(isValidIdleTimeout(60)).toBe(true);
    expect(isValidIdleTimeout(10)).toBe(false);
  });
});
