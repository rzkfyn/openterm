import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBiometricName } from '../platform';

describe('platform utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Touch ID or Windows Hello based on platform', () => {
    const name = getBiometricName();
    expect(['Touch ID', 'Windows Hello', 'Biometrics']).toContain(name);
  });
});
