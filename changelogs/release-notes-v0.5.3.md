# OpenTerm v0.5.3 Release Notes

OpenTerm v0.5.3 delivers major enhancements across connection organization, FileZilla and OpenTerm configuration portability, master vault disaster recovery, and SFTP file management reliability.

## What's New

### 1. Connection Folders & SFTP Directory Bookmarks (#12)
- **Folder Organization**: Group saved connections by folder with quick-filter pills, collapsible dashboard sections, and batch management.
- **Directory Bookmarks**: Store quick-access local and remote directory pairs per connection with a jump dropdown in the dual-pane file manager.
- **Bookmark Modal Editor**: Easily manage, test, and jump to bookmarked paths with single-click navigation.

### 2. FileZilla & OpenTerm Import/Export (#13)
- **FileZilla XML Parser**: Import server profiles directly from FileZilla XML exports (`sitemanager.xml` / `filezilla.xml`), mapping host, port, username, keyfile, and remote directories into OpenTerm connections.
- **OpenTerm JSON Backup**: Export and import full connection profiles with folder tags and bookmarks.
- **Interactive Conflict Modal**: Preview imports with collision detection (skip, overwrite, duplicate rename) and selective checkbox importing.

### 3. Vault Emergency Recovery & Rate-Limiting (#10)
- **Emergency Recovery Key**: Generate 128-bit emergency recovery tokens (`OT-XXXX-XXXX-XXXX-XXXX`) during vault setup, escrowing an independently encrypted key payload.
- **Zero-Knowledge Recovery Flow**: Restore vault access without knowing the master password using recovery token combined with 2FA TOTP verification.
- **Lockout Protection**: Enforce exponential backoff and 30-second UI lockout after 5 consecutive failed unlock attempts to defend against brute force.

### 4. 2FA Idle Timeout & UI Fixes (#8, #9, #11)
- **Offline QR Code Display**: Render TOTP QR codes locally using offline SVG/canvas generation without leaking secrets over external HTTP APIs.
- **Idle Timeout Persistence**: Fixed falsy bug (`0 || 15`) where disabling the 2FA timeout (setting to 0) improperly reverted to 15 minutes.
- **Centralized TOTP Store**: Decoupled 2FA state from component mount lifecycles with persistent Zustand store.
- **Vault Modal Reset**: Automatically resets modal view mode on open to prevent locked vaults opening in password-change view.

### 5. SFTP Drag-and-Drop & Path Normalization (#14)
- **Target Folder Drop**: Dropping files onto a specific folder row now uploads directly into that target subfolder rather than the parent directory.
- **POSIX Path Normalization**: Replaced Windows backslashes with POSIX forward slashes in remote paths and resolved `.` canonical working directory via SFTP `realpath`.
- **View Preservation**: Directory view maintains current navigation context after transfers finish without reverting to root or initial home directory.
- **Auto-Refresh**: Transferred files display immediately in the pane upon background transfer completion.

---

## Verification & Stability
- 29/29 Cargo unit and integration tests passing.
- 62/62 Vitest unit and component tests passing.
- Clean Vite production build.
