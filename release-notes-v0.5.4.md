# OpenTerm v0.5.4 Release Notes

OpenTerm v0.5.4 addresses a critical deserialization error when importing FileZilla and OpenTerm configurations, guards the import workflow against locked vaults, and enhances release update checking with shorter caching and manual status bar refresh.

## What's New & Fixes

### 1. Fix Connection Import Payload & Rust Serde Deserialization
- **Payload Sanitization**: Explicitly populated missing `id`, `createdAt`, `updatedAt`, and default `authType` in `ImportExportModal` before calling `saveConnection`.
- **Serde Defaults**: Added `#[serde(default = "generate_uuid")]` on connection `id` and `#[serde(default)]` on `created_at` and `updated_at` in Rust `storage.rs`, preventing deserialization rejections for partial imported payloads.
- **UUID Guard**: Enforced automatic UUID generation in `save()` and `save_vault_connection()` when an empty ID string is encountered.

### 2. Vault Lock Guard on Import / Export
- **Locked Vault Protection**: Clicking "Import / Export" on the Dashboard when the vault is encrypted and locked now redirects to the Vault Unlock modal instead of failing later on write.

### 3. Responsive Update Checks
- **Shorter Cache Interval**: Reduced release check cache interval from 6 hours to 30 minutes to ensure newly published releases appear promptly.
- **Manual Click-to-Check**: Clicking the version label (`v0.5.x`) in the status bar now forces an immediate update check with live spinner feedback (right-click retains opening release history).

---

## Verification & Stability
- 29/29 Cargo unit and integration tests passing.
- 63/63 Vitest unit and component tests passing.
- Clean Vite production build.
