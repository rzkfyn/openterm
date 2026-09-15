/**
 * Platform detection utilities.
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || '');

export const isWindows =
  typeof navigator !== 'undefined' &&
  /Win/i.test(navigator.userAgent || navigator.platform || '');

/**
 * Returns the platform-appropriate name for the primary biometric method.
 * - macOS: 'Touch ID'
 * - Windows: 'Windows Hello'
 * - Other: 'Biometrics'
 */
export function getBiometricName(): string {
  if (isMac) return 'Touch ID';
  if (isWindows) return 'Windows Hello';
  return 'Biometrics';
}
