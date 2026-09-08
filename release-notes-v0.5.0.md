# OpenTerm v0.5.0 Release Notes

OpenTerm v0.5.0 brings major enhancements spanning remote file editing, security, resilient networking, customizable layouts, transfer conflict handling, and productivity workflows.

## What's New in v0.5.0

### 1. Remote File Editor & SFTP Context Menu (Phase 1)
- **Built-in File Editor**: Edit text, config, and script files directly on remote hosts or locally without leaving OpenTerm.
- **Permissions Management (chmod)**: Visual octal and permission bit editor (`0644`, `0755`, etc.).
- **SFTP Context Menu**: Right-click actions for Touch (New File), Mkdir (New Folder), Rename, Delete, Edit, Transfer, and Chmod.

### 2. Resizable Split Layouts & Tab Management (Phase 2)
- **Draggable Splitters**: Resize Terminal vs. SFTP panes and Local vs. Remote panes with persisted layout ratios.
- **Session Status Dots**: Live colored indicators for Live PTY, Connecting, Reconnecting, and Disconnected.
- **Tab Context Menu**: Quickly Close Tab, Close Other Tabs, Close All, or Reconnect directly from tab bars.

### 3. Transfer Conflict Resolution (Phase 3)
- **Transfer Conflict Dialog**: Compare local vs. remote file size and modified timestamps side-by-side.
- **5 Resolution Options**: Overwrite, Overwrite if Newer, Overwrite if Size Differs, Auto-Rename `(n)`, or Skip.
- **Compound Extension Preservation**: Safe auto-renaming for files like `.tar.gz`, `.tar.bz2`, and `.tar.xz`.
- **Batch Resolution**: "Apply to all remaining conflicts" option.

### 4. Encrypted Profile Vault (Phase 4)
- **Master Password Security**: AES-256-GCM + PBKDF2-HMAC-SHA256 (100,000 rounds) profile encryption (`vault.enc`).
- **Credential Storage**: Securely store SSH passwords and private key passphrases encrypted at rest.
- **Session Locking**: Lock and unlock profiles on demand or when stepping away.

### 5. App Lock & Two-Factor Authentication (2FA) (Phase 5)
- **RFC 6238 TOTP Authenticator**: Connect Google Authenticator, Aegis, 1Password, or any TOTP app.
- **Emergency Recovery Codes**: 8 single-use backup recovery codes.
- **Auto-Lock on Idle**: Configurable timeout (5m, 15m, 30m, 1h) or manual lock.
- **App Lock Shield**: Fullscreen protection guarding credentials and open sessions.

### 6. Resilient Sessions & Auto-Reconnect (Phase 6)
- **TCP Keepalive Heartbeats**: Active keepalive probes sent every 15 seconds to prevent NAT/router timeouts.
- **Exponential Backoff Reconnect**: Automatic reconnection attempts (1s, 2s, 4s, 8s, 16s) on network dips.
- **Session State Preservation**: Preserves terminal output history and remote SFTP directory location across reconnects.

### 7. SFTP Quick Search & Keyboard Shortcuts (Phase 7)
- **Instant Search Filter (`Ctrl+F`)**: Instant substring search filtering in both local and remote file panes.
- **Direct Path Editing (`Ctrl+L` / `Alt+D`)**: Jump directly to manual path input.
- **Standard Shortcuts**:
  - `F5` / `Ctrl+R`: Refresh directory
  - `F2`: Rename selected file/folder
  - `Delete`: Remove selected file/folder
  - `Ctrl+N`: New file
  - `Ctrl+Shift+N`: New folder
  - `Enter`: Open folder / edit file
  - `Backspace` / `Alt+Up`: Navigate to parent directory
  - `ArrowUp` / `ArrowDown`: File list navigation

---

## Verification & Stability
- 33/33 Vitest tests passing.
- Full Rust unit test suite passing.
- Production build verified.
