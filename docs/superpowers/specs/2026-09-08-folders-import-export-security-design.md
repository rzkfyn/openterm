# Connection Folders, FileZilla Import/Export, and Vault Recovery Specification

## 1. Objectives
- **Connection Organization**: Support hierarchical folder groupings (`folder?: string`) and SFTP directory bookmarks (`bookmarks?: ConnectionBookmark[]`).
- **Import/Export Engine**: Bi-directional import and export supporting FileZilla Site Manager XML (`FileZilla3`) and OpenTerm native JSON, with an interactive preview and deduplication UI.
- **SFTP Integration**: Bookmark jump dropdown in `DualPaneExplorer` for dual local/remote navigation.
- **Security Hardening**:
  - Vault Recovery Key (Option B): 128-bit emergency key escrowed in vault metadata; allows recovering a forgotten master password when paired with 2FA.
  - Rate limiting: 5 consecutive failed master password attempts triggers a 30s cooldown.
  - Offline QR code generation for 2FA TOTP setup.
  - Fix TOTP idle timeout falsy bug (`0 || 15` -> `?? 15`) and centralize state via `totpStore`.

---

## 2. Data Models

### TypeScript (`src/types/index.ts`)
```typescript
export interface ConnectionBookmark {
  id: string;
  name: string;
  localPath?: string;
  remotePath?: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  privateKeyPath?: string;
  password?: string;
  passphrase?: string;
  folder?: string;
  bookmarks?: ConnectionBookmark[];
  createdAt: number;
  updatedAt: number;
}
```

### Rust Structs (`src-tauri/src/storage.rs`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionBookmark {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bookmarks: Vec<ConnectionBookmark>,
    pub created_at: i64,
    pub updated_at: i64,
}
```

---

## 3. Subsystems

### A. FileZilla XML Parser (`filezillaParser.ts`)
- Parse XML using DOMParser.
- Recursively extract `<Folder>` name hierarchy.
- Read `<Server>` elements: `Host`, `Port`, `User`, `Pass` (base64 decoded), `Keyfile`.
- Decode `<RemoteDir>`: parses FileZilla custom serialized path format (e.g. `1 0 3 opt 14 service1 10 service1` -> `/opt/service1/service1`).

### B. Interactive Import/Export Modal (`ImportExportModal.tsx`)
- Drag-drop `.xml` and `.json` files.
- Parse entries and check collisions with existing connections (`host` + `port` + `username`).
- Show selection list with checkboxes and status pill ("New", "Duplicate").
- Allow choosing conflict strategy: "Rename duplicates (1)" or "Overwrite".

### C. Dashboard & SFTP Folders / Bookmarks
- `Dashboard.tsx`: Folders displayed as collapsible groups with item counters; filter chips for quick filtering.
- `NewConnectionModal.tsx`: Autocomplete for folder names; bookmark manager for local & remote pairs.
- `DualPaneExplorer.tsx`: Quick jump dropdown with active session bookmarks.

### D. Vault Recovery & Lockout (`vault.rs`, `VaultModal.tsx`)
- Recovery Key generation: `OT-` followed by 16 alphanumeric characters separated by hyphens.
- Key escrow: Encrypted master key payload embedded in `EncryptedVaultPayload`.
- Recovery command: `vault_recover(recovery_key, totp_code, new_password)`.
- Lockout: UI enforces 30-second delay after 5 failed attempts.
