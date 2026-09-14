import { describe, it, expect } from 'vitest';
import { SavedConnection } from '../../../types';

function shouldPromptSecurityGate(
  _conn: SavedConnection,
  isTotpEnabled: boolean,
  isBiometricEnabled: boolean
): boolean {
  const isSecurityConfigured = isTotpEnabled || isBiometricEnabled;
  return !isSecurityConfigured;
}

describe('Security Onboarding Gate Rule', () => {
  const baseConn: SavedConnection = {
    id: 'test-1',
    name: 'Test Server',
    host: 'example.com',
    port: 22,
    username: 'admin',
    authType: 'password',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('triggers gate when user saves password without TOTP or Biometrics', () => {
    const connWithPassword = { ...baseConn, password: 'secretpassword' };
    expect(shouldPromptSecurityGate(connWithPassword, false, false)).toBe(true);
  });

  it('triggers gate when user saves key passphrase without TOTP or Biometrics', () => {
    const connWithPassphrase = {
      ...baseConn,
      authType: 'key' as const,
      privateKeyPath: '/home/key',
      passphrase: 'keypassphrase',
    };
    expect(shouldPromptSecurityGate(connWithPassphrase, false, false)).toBe(true);
  });

  it('does NOT trigger gate when TOTP is already enabled', () => {
    const connWithPassword = { ...baseConn, password: 'secretpassword' };
    expect(shouldPromptSecurityGate(connWithPassword, true, false)).toBe(false);
  });

  it('does NOT trigger gate when Biometrics is already enabled', () => {
    const connWithPassword = { ...baseConn, password: 'secretpassword' };
    expect(shouldPromptSecurityGate(connWithPassword, false, true)).toBe(false);
  });

  it('triggers gate even when saving profile without stored credentials to enforce app protection', () => {
    const connWithoutCreds = { ...baseConn, password: undefined, passphrase: undefined };
    expect(shouldPromptSecurityGate(connWithoutCreds, false, false)).toBe(true);
  });
});
