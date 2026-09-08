# OpenTerm v0.5.2 Release Notes

OpenTerm v0.5.2 introduces automatic update checking on launch and status bar version visibility, keeping users informed of security maintenance and feature releases.

## What's New

### 1. Launch Update Checker
- Added lightweight background update checker querying GitHub releases on startup.
- Uses semantic versioning comparison (`isNewerVersion`) to alert users to new releases.
- Cached check result with a 6-hour interval in `localStorage` to minimize network overhead and avoid GitHub API rate limits.
- Fails silently when offline or unreachable, with zero startup delay.

### 2. Status Bar Version Display & Update Alert
- Display current app version (`v0.5.2`) in the status bar beside the GitHub repository link.
- Clicking the version badge opens the release history page.
- When an update is detected, displays an animated badge (`Update vX.X.X`) with direct link to the release notes and download page.
- Dismiss button (`✕`) allows hiding the update badge for the current session.

### 3. CI/CD Release Automation Hardening
- Synchronized `src/version.ts` versioning alongside `package.json`, `Cargo.toml`, and `tauri.conf.json` in GitHub Actions release workflow.

---

## Verification & Stability
- 27/27 Cargo unit and integration tests passing.
- 44/44 Vitest tests passing.
