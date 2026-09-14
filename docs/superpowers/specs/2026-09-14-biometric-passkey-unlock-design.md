# Design Specification: Side-Key Biometric / Windows Hello & Passkey Login

**Date:** 2026-09-14  
**Feature:** Dual 2FA / Biometric Passkey Unlock (Windows Hello / Touch ID / TOTP)  
**Status:** Draft  

---

## 1. Problem Statement
Users currently unlock OpenTerm with a 6-digit TOTP code (or recovery code). While secure, typing codes on every session or lock timeout adds friction. Users want a fast, native biometric passkey option (Windows Hello fingerprint/PIN/facial recognition) as an alternate unlock method without replacing TOTP. Either method must independently unlock the app.

---

## 2. Goals & Non-Goals

### Goals
- **Either / Or Unlock**: App unlocks if *either* biometric verification succeeds *or* valid 6-digit TOTP / recovery code is entered.
- **Mandatory Protection Gate for Saved Credentials**: If a user saves credentials (password or encrypted key passphrase to disk), the app requires at least one protection method (Windows Hello / Passkey OR TOTP). New users are prompted to set up either method before credentials persist to disk.
- **Unsaved Connections Allowed**: Users can connect transiently without saving credentials without triggering the security gate (zero friction for quick one-off tasks).
- **Native OS Biometrics**: Use Windows Hello (`UserConsentVerifier`) on Windows and platform-native fallbacks, zero remote network dependencies.
- **Graceful Fallback**: If biometric verification is cancelled, fails, or is unsupported, user remains on the TOTP lock screen without interruption.
- **Opt-in Setting**: User can enable/disable Biometric / Passkey unlock in Security Settings.

### Non-Goals
- Replacing TOTP setup (TOTP remains the primary recovery anchor).
- Remote web-based FIDO2 cloud synchronization across devices.

---

## 3. Architecture & Data Flow

```
+-----------------------------------------------------------+
|                     AppLockOverlay                        |
|                                                           |
|  [ 123456 (TOTP Auto-Submit) ]    [ 👆 Windows Hello /   |
|                                     Passkey Button ]      |
+-----------------------------------------------------------+
              |                                     |
              v                                     v
     tauriApi.totpValidateLogin           tauriApi.biometricPrompt
              |                                     |
              v                                     v
       TOTP HMAC Check                     Windows Hello Native
                                           (UserConsentVerifier)
              \                                     /
               \---> [ App Unlock: State = Open ] <-/
```

### 3.1 Backend (Rust / Tauri)
- Expose `biometric_is_available() -> Result<bool, String>`:
  Checks Windows `UserConsentVerifier::CheckAvailabilityAsync()` (or returns false if unsupported).
- Expose `biometric_authenticate(prompt_message: &str) -> Result<bool, String>`:
  Invokes `UserConsentVerifier::RequestVerificationAsync(message)`. Returns `true` if verified, `false` on cancel/incorrect.
- Store preference in app settings (`biometric_enabled: bool`).

### 3.2 Frontend (React / TypeScript)
- `AppLockOverlay`:
  - When biometric is enabled and available on the machine, display a prominent button: **"Unlock with Windows Hello / Passkey"** (with Fingerprint/Key icon).
  - Optionally trigger biometric prompt automatically on overlay mount if enabled.
  - On biometric success: clear overlay, trigger `onUnlock()`.
  - On biometric failure or cancel: remain on TOTP screen, keep TOTP input focused.
- `SecuritySettings`:
  - Show toggle: **"Enable Windows Hello / OS Passkey Unlock"**.
  - Disable toggle if device reports no biometric/PIN hardware available.

### 3.3 Mandatory Protection Gate for Saved Credentials
- When user clicks **Save** or **Save & Connect** with stored credentials (`remember password/passphrase` checked):
  - Check if either **TOTP** or **Biometrics** is active.
  - If neither is active:
    - Display **"Setup App Protection"** onboarding modal before saving to disk.
    - Option A: **1-Click Windows Hello / Passkey** (fast path, tests biometric verification immediately).
    - Option B: **Setup Authenticator 2FA** (QR code + TOTP).
  - Once either method is activated, the profile save completes.
- When user connects without saving (or saves with credentials omitted), the connection proceeds immediately with no gate.

### 3.4 Hardware / TPM Failure & BIOS Update Recovery
- **Failure Threat**: BIOS updates, motherboard swaps, dual-boot changes, or game anti-cheat drivers (e.g. Vanguard/Ricochet) can reset or corrupt the TPM endorsement hierarchy, permanently invalidating Windows Hello credentials.
- **Recovery Architecture**:
  - **Emergency Recovery Codes**: When user configures Windows Hello / Passkey without TOTP, generate emergency backup recovery codes (or reuse TOTP backup codes store in `totp.json`).
  - **Degraded Hardware Detection**: If Windows Hello API returns `NotConfigured`, `DeviceNotPresent`, or hardware errors, the lock screen gracefully shifts to recovery mode without crashing or permanently locking the user out.
  - **Master Vault Decoupling**: Profiles stored in `vault.enc` or `connections.json` remain mathematically decryptable via Master Password, ensuring physical disk recovery is always possible without TPM dependency.

---

## 4. Security Considerations
- Biometric verification only unlocks the local UI state in RAM.
- TOTP secret remains securely stored in local storage / vault.
- Biometric cannot be used to bypass master key encryption without valid hardware attestation.

---

## 5. Verification Plan
- Unit tests for biometric availability state and config serialization.
- Visual and keyboard navigation tests for `AppLockOverlay`.
- Manual verification of Windows Hello prompt and TOTP bypass.
