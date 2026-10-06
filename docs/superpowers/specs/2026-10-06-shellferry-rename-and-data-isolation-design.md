# ShellFerry: Rename & Data Isolation

## Problem
An unrelated app, `SurviveANDcraft/OpenTerm`, ships with the same Tauri `identifier`
(`com.openterm.app`) and a `productName` that matches ours case-insensitively (`OpenTerm` vs
`openterm`). Tauri's NSIS installer builds these from the two values:

- uninstall key `HKCU\...\Uninstall\${PRODUCTNAME}`, plus a previous-install lookup, so each app installs over the other
- Start Menu shortcut `${PRODUCTNAME}.lnk`, which gets overwritten even when the install path is different
- app data `%APPDATA%\${identifier}`, which is shared, and the other app's "Delete app data" uninstall option `RmDir /r`s it, including our `vault.enc`
- WebView2 profile `%LOCALAPPDATA%\${identifier}\EBWebView`, which is shared

Separately, `totp.json` stores the TOTP shared secret in plain text.

## Decisions
| Item | Value |
|---|---|
| Product name | `ShellFerry` |
| Identifier | `io.github.rzkfyn.shellferry` (reverse-DNS of a namespace we control) |
| Crate / lib | `shellferry` / `shellferry_lib` |
| Version | `0.8.0` |
| GitHub repo URLs | unchanged (`rzkfyn/openterm`). GitHub redirects if the repo is renamed later |

## Design

### 1. Identity
Rename in `tauri.conf.json`, `Cargo.toml`, `main.rs`, `package.json`, `index.html`, README,
release workflow, and user-visible UI strings. Internal keys stay as they are: the `openterm_*`
localStorage keys, the `application/x-openterm-transfer` drag MIME type, and the `OT-` prefix on
recovery tokens.

### 2. Data paths
New `paths.rs` holds `IDENTIFIER`, `LEGACY_IDENTIFIER` and `config_dir()`
(`dirs::config_dir()/IDENTIFIER`). This replaces three hardcoded `"com.openterm.app"` joins.
A unit test asserts that `IDENTIFIER` matches `tauri.conf.json`.

### 3. One-time migration (`migrate.rs`, runs in `setup()` before any window exists)
- Moves only our files from `config_dir/com.openterm.app` to `config_dir/<new id>`:
  `vault.enc`, `connections.json`, `totp.json`.
  - The move is a rename, falling back to copy, then byte-compare, then delete the old file.
  - If the destination already exists, the file is skipped. A failure is logged and the old file is left in place.
- Windows only: copies `EBWebView/Default/Local Storage` (UI preferences) into the new
  profile, but only if the new profile doesn't have one yet. The old copy is kept, because the
  other app still uses that folder.
- The main window is set to `"create": false` and is built in `setup()` after the migration, so
  WebView2 doesn't open the new profile before it has been populated.

### 4. TOTP secret in the OS keychain
- `keyring` 4.2 (`v1` feature): Windows Credential Manager, macOS Keychain, Linux Secret Service.
  The entry is service = `IDENTIFIER`, account = `totp-secret`.
- `totp.json` keeps only `enabled`, `backup_code_hashes` and `idle_timeout_mins`. The legacy
  `secret` field is read but never written.
- Lazy migration on read: a legacy secret is written to the keychain, then removed from the file.
  If the keychain write fails, the file is left unchanged and the migration is retried next time.
- Enable: fails with a clear error if the keychain is unavailable. There is no plain-text fallback.
- Disable: deletes the keychain entry.
- If the secret is missing from the keychain, TOTP verification fails but backup codes still work.
- Logic is written against a `SecretStore` trait so tests can use an in-memory store.

Limitation: this protects the secret against file copies, backups and shared folders. It does
not protect against malware running as the same OS user.

## Out of scope / follow-up
- Backup codes use unsalted SHA-256 over 40 bits of randomness, which can be brute-forced
  offline. Move them to salted PBKDF2.
- On macOS and Linux, localStorage (UI preferences) is not migrated. Vault, connections and TOTP are.

## Verification
- Rust: migration cases, the TOTP secret split and legacy migration, the identifier sync test,
  and the existing tests.
- Frontend: update the tests that assert "OpenTerm" strings.
- Manual (Windows): the installer creates a separate Start Menu entry and uninstall key; vault
  unlock and TOTP login work after migration; `totp.json` no longer contains `secret`;
  uninstalling the other OpenTerm with "delete data" leaves ShellFerry's data intact.
