# Implementation Plan: Side-Key Biometric / Windows Hello & Passkey Login

**Date:** 2026-09-14  
**Spec:** `docs/superpowers/specs/2026-09-14-biometric-passkey-unlock-design.md`  

---

## Proposed Changes

### 1. Rust Backend (`src-tauri`)
- Add `src-tauri/src/biometrics.rs`:
  - `biometric_is_available()`: Detect if OS supports Windows Hello / biometrics.
  - `biometric_authenticate(reason: String)`: Invoke OS biometric verification prompt.
- Update `src-tauri/src/lib.rs` / `main.rs`:
  - Register `biometric_is_available` and `biometric_authenticate` Tauri commands.
- Update `src-tauri/Cargo.toml` with windows biometric dependencies if needed or safe platform fallback.

### 2. Frontend Services & Types (`src/types`, `src/services`)
- Add `biometricEnabled?: boolean` to app settings / security config in `src/types/index.ts`.
- Add `tauriApi.biometricIsAvailable()` and `tauriApi.biometricAuthenticate(reason: string)` in `src/services/tauri.ts`.

### 3. App Lock Overlay (`src/components/Modal/AppLockOverlay.tsx`)
- Query biometric availability on mount.
- Display "Unlock with Windows Hello / Passkey" button.
- If biometric succeeds, immediately call `onUnlock()`.
- If cancelled or failed, keep TOTP input ready with zero interruption.

### 4. Security Settings & Config
- Add toggle for "Windows Hello / OS Biometric Passkey" unlock in Security settings.
- Automatically disabled if system lacks biometric/PIN support.

### 5. Mandatory Protection Gate for Saved Credentials
- Create `src/components/Modal/SecurityOnboardingModal.tsx`:
  - Shown when user clicks "Save" / "Save & Connect" with remembered credentials, but neither TOTP nor Biometrics is enabled.
  - Allows 1-click Windows Hello setup or 2FA Authenticator setup.
  - Allows temporary unsaved connection without gating.
- Wire gate in `NewConnectionModal.tsx` and `App.tsx`.

---

## Verification Plan
1. `npm test`: Run existing and new unit tests for AppLockOverlay, SecurityOnboardingModal, and biometric fallbacks.
2. `npm run build`: Verify TypeScript compilation and Vite packaging.
3. Live test: Open locked app, verify biometric prompt pops up and unlocks cleanly into app without typing TOTP, and verify 6-digit TOTP still works as side-by-side alternative. Verify new user cannot save credentials without setting up at least one method, while unsaved connection still works without friction.
