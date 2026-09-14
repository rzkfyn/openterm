import { describe, it, expect } from 'vitest';
import { SavedConnection } from '../../../types';

function shouldShowVaultReminder(
  isEncrypted: boolean,
  isDismissed: boolean,
  connections: SavedConnection[]
): boolean {
  return !isEncrypted && !isDismissed && connections.some((c) => Boolean(c.password || c.passphrase));
}

describe('Vault Reminder Banner', () => {
  const connWithoutCreds: SavedConnection = {
    id: '1',
    name: 'Server 1',
    host: '1.2.3.4',
    port: 22,
    username: 'root',
    authType: 'password',
    createdAt: 0,
    updatedAt: 0,
  };

  const connWithPassword: SavedConnection = {
    ...connWithoutCreds,
    id: '2',
    password: 'secretpassword',
  };

  const connWithPassphrase: SavedConnection = {
    ...connWithoutCreds,
    id: '3',
    authType: 'key',
    passphrase: 'secretpassphrase',
  };

  it('shows reminder if unencrypted and user has saved password', () => {
    expect(shouldShowVaultReminder(false, false, [connWithPassword])).toBe(true);
  });

  it('shows reminder if unencrypted and user has saved key passphrase', () => {
    expect(shouldShowVaultReminder(false, false, [connWithPassphrase])).toBe(true);
  });

  it('does NOT show reminder if vault is already encrypted', () => {
    expect(shouldShowVaultReminder(true, false, [connWithPassword])).toBe(false);
  });

  it('does NOT show reminder if dismissed by user', () => {
    expect(shouldShowVaultReminder(false, true, [connWithPassword])).toBe(false);
  });

  it('does NOT show reminder if no connections have saved credentials', () => {
    expect(shouldShowVaultReminder(false, false, [connWithoutCreds])).toBe(false);
  });
});
