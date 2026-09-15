# OpenTerm v0.7.0 Release Notes

OpenTerm v0.7.0 brings full-app theme synchronization, an application Settings modal with customizable typography and font zoom shortcuts, in-buffer terminal text search with live match navigation, hardware biometric authentication (Windows Hello & macOS Touch ID), emergency backup codes, bi-directional Terminal-SFTP directory synchronization, keyboard text selection, and SSH quick commands.

---

## What's New in v0.7.0

### 1. Application Settings & Typography Customization (#35)
- **Settings Modal (`Cmd+,` / `Ctrl+,`)**: Dedicated preferences dialog accessible via header gear icon, dashboard button, and global keyboard shortcut.
- **Independent Monospace Font Stacks**: Choose from *JetBrains Mono*, *Fira Code*, *Cascadia Code*, *SF Mono*, *Menlo*, *Monaco*, *Consolas*, *Source Code Pro*, *System Monospace*, or specify custom font families.
- **Terminal Sizing & Line Height**: Real-time font size slider (10px–24px) and configurable line height (1.0–1.4).
- **Application Interface Font**: Separately configure app UI font (*System Default*, *Geist Sans*, *Inter*, *Segoe UI*, *Roboto*, *Ubuntu*, or custom).
- **Live Terminal Font Zoom Shortcuts**: `Cmd/Ctrl + "+"` (zoom in), `Cmd/Ctrl + "-"` (zoom out), and `Cmd/Ctrl + "0"` (reset zoom) directly inside active terminal sessions.
- **Terminal Preferences**: Configurable cursor style (*Block*, *Underline*, *Bar*), cursor blink, scrollback buffer (up to 20,000 lines), and copy-on-select.

### 2. Terminal In-Buffer Text Search (#35, #36)
- **Find in Terminal (`Cmd+F` / `Ctrl+F`)**: Floating search overlay with live match highlighting and match index counter (`1/14`).
- **Match Options**: Next/previous navigation (`Enter` / `Shift+Enter`), match case (`Aa`), whole word (`\b`), and regular expressions (`.*`).
- **Robust Error Handling**: Added `allowProposedApi: true` for decoration APIs, real-time regex syntax validation with visual error indicators, and wrapped `TerminalView` in React `ErrorBoundary`.
- **Search Re-triggering & Input Isolation**: Support pressing `Cmd+F` with newly highlighted terminal text to search the new query; guarded shortcuts to prevent hijacking keystrokes in active input fields and modals.

### 3. Biometric Passkey & Two-Factor Authentication (#34, #35)
- **Cross-Platform Biometrics**:
  - **Windows**: Native Windows Hello (Fingerprint / PIN / Facial Recognition) integration via `IUserConsentVerifierInterop` offloaded to background threads to prevent UI freezes.
  - **macOS**: Native Apple Touch ID / Device Owner Authentication via `LocalAuthentication.framework` (`objc2-local-authentication`).
- **Contextual Platform UI**: Dynamically labels biometric prompts as "Touch ID" on macOS vs "Windows Hello" on Windows.
- **Mandatory Onboarding Gate**: Prompts master password or passkey enrollment before saving unencrypted SSH profiles to disk.
- **Seamless 2FA Unlock**: Auto-unlocks the application on entering the 6th TOTP digit without flashing spurious errors during typing.

### 4. Emergency Recovery Codes & TPM Reset Protection (#34)
- **Emergency Backup Kit**: Generates 8 one-time backup codes during biometric onboarding to safeguard against lockout after TPM, BIOS, or OS credential resets.
- **Biometric-Protected Kit Generation**: Requires active biometric verification before displaying or re-generating emergency codes.
- **Dashboard Security Banner**: Dismissible reminder prompts users to generate emergency codes or enable master password disk encryption.

### 5. Bi-Directional Terminal-SFTP Directory Synchronization
- **Terminal -> SFTP Tracking**: Parses shell OSC 7 escape sequences to automatically navigate the remote file manager pane to the terminal's working directory.
- **SFTP -> Terminal Navigation**: Changing directories in the SFTP remote pane automatically issues safe `cd` commands to the terminal shell.
- **Ping-Pong Loop Guard**: Sync coordinator prevents recursive directory update cycles.
- **Configurable Auto-Sync**: Toggleable directly from the SFTP toolbar or within the Settings modal.

### 6. Terminal Selection, Input Fixes & Quick Commands
- **Keyboard Text Selection**: Supports `Shift+Arrow` text selection directly inside xterm without leaking raw ANSI escape sequences to the remote shell.
- **Paste & Focus Restoration**: Prevents duplicate paste events and guarantees keyboard focus returns to the terminal cursor after context menu actions.
- **SSH Quick Commands**: Quick command dropdown menu with pre-configured operational snippets (`top`, `df -h`, `free -m`, `docker ps`, etc.) with focus restoration.
- **Multi-Token File Filter**: Multi-word fuzzy search filter in local and remote SFTP file panes.

### 7. Full-App Theme Synchronization (#35)
- **Chrome-Wide Theme Synchronization**: Extended theme presets (*Midnight*, *Dracula*, *One Dark*, *Nord*, *Solarized Dark*) beyond the xterm terminal canvas to the entire application chrome (Header, Status Bar, Dashboard, File Explorer, Directory Tree, and all Modals).
- **Dynamic CSS Variables**: Fast DOM root theme attributes (`[data-theme]`) without component unmounting or page reloads.
- **Segmented Security Toolbar**: Cleaned up dashboard security controls into a unified segmented toolbar with active indicator dots.

### 8. Connection Lifecycle Fix (#35)
- **Safe Save & Connect**: Inverted connection execution order in `handleSaveAndConnect` to prevent saving broken or unreachable connection profiles when SSH authentication fails.

---

### Verification
- `npm run build`: Success (0 TypeScript errors)
- `npm test`: **28 test files passed, 127 tests passed (100%)**
- `cargo test`: **32 tests passed (100%)**
