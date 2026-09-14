import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAuthenticate = vi.fn().mockResolvedValue(true);
const mockCheckAvailability = vi.fn();

vi.mock('../../../stores/biometricStore', () => ({
  useBiometricStore: () => ({
    isAvailable: true,
    isEnabled: true,
    checkAvailability: mockCheckAvailability,
    authenticate: mockAuthenticate,
  }),
}));

vi.mock('../../../services/tauri', () => ({
  tauriApi: {
    totpValidateLogin: vi.fn().mockResolvedValue(true),
  },
}));

// Mock react hooks to execute effects synchronously for testing
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
    useEffect: (fn: () => any) => {
      fn();
    },
  };
});

import { AppLockOverlay } from '../AppLockOverlay';

describe('AppLockOverlay Auto-Lock Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT auto-invoke biometric authenticate when lock overlay opens', () => {
    AppLockOverlay({ isOpen: true, onUnlock: vi.fn() });

    // Advance any timers
    vi.runAllTimers();

    expect(mockCheckAvailability).toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('does not check availability when closed', () => {
    const element = AppLockOverlay({ isOpen: false, onUnlock: vi.fn() });

    expect(element).toBeNull();
    expect(mockCheckAvailability).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('provides manual biometric unlock handler that invokes authenticate', async () => {
    const onUnlock = vi.fn();
    const element = AppLockOverlay({ isOpen: true, onUnlock }) as any;

    expect(element).not.toBeNull();
    // Locate the manual unlock button in rendered JSX tree
    const button = element.props.children.props.children[2].props.children[0];
    expect(button.props.type).toBe('button');

    await button.props.onClick();

    expect(mockAuthenticate).toHaveBeenCalledWith('Unlock OpenTerm');
    expect(onUnlock).toHaveBeenCalled();
  });
});
