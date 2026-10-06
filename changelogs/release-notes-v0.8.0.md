# ShellFerry v0.8.0 Release Notes

**OpenTerm is now ShellFerry.** An unrelated app also called "OpenTerm" used the same Windows
install identity. Installing either app overwrote the other's install, Start Menu shortcut, and
app-data folder. ShellFerry now has its own identity and installs fully separately.

---

## What's New

### 1. New name and isolated install
- New app identifier `io.github.rzkfyn.shellferry`, plus its own install folder, Start Menu shortcut, and uninstall entry.
- Data now lives in `%APPDATA%\io.github.rzkfyn.shellferry` (Windows) or the equivalent per-OS config folder.

### 2. Automatic migration
- On first launch, your vault (`vault.enc`), saved connections, and 2FA settings move from the old `com.openterm.app` folder. Only ShellFerry's own files are touched.
- UI preferences (theme, layout, split sizes) are copied over on Windows.
- The migration is non-destructive: a file is only removed from the old location after its copy has been verified.

### 3. 2FA secret moved to the OS keychain
- The TOTP secret is no longer stored in plain text in `totp.json`. It now lives in Windows Credential Manager, macOS Keychain, or Linux Secret Service.
- Existing 2FA setups migrate automatically. Your authenticator app keeps working, and the entry may still show the name "OpenTerm".

## Upgrading
1. Install ShellFerry v0.8.0 and launch it once so the migration runs.
2. Uninstall the old "openterm" entry from Windows Settings > Apps. Leave "Delete the application data" **unchecked**, because that folder may be shared with the unrelated OpenTerm app.

### 4. Built-in updater
- Updates now install from inside the app. When a new version is available, click **Install** in the status bar (or **Install Update** in the changelog), watch the progress, then **Restart to update**.
- Every update is cryptographically signed and verified before installing. Tampered downloads are rejected.
- This is the last version you'll need to download manually.
