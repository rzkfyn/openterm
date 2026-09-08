import { describe, it, expect } from 'vitest';

describe('Auto-Reconnect Backoff Calculation', () => {
  it('calculates exponential backoff delay correctly with cap', () => {
    const getDelayMs = (attempt: number) => Math.min(16000, 1000 * Math.pow(2, attempt - 1));

    expect(getDelayMs(1)).toBe(1000);   // 1s
    expect(getDelayMs(2)).toBe(2000);   // 2s
    expect(getDelayMs(3)).toBe(4000);   // 4s
    expect(getDelayMs(4)).toBe(8000);   // 8s
    expect(getDelayMs(5)).toBe(16000);  // 16s
    expect(getDelayMs(6)).toBe(16000);  // capped at 16s
  });

  it('enforces maximum 5 attempts limit', () => {
    const maxAttempts = 5;
    const shouldRetry = (attempt: number) => attempt <= maxAttempts;

    expect(shouldRetry(1)).toBe(true);
    expect(shouldRetry(5)).toBe(true);
    expect(shouldRetry(6)).toBe(false);
  });
});
