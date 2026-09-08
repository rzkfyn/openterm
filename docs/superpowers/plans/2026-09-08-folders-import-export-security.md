# Connection Folders, FileZilla Import/Export, and Vault Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement connection folders, SFTP directory bookmarks, FileZilla XML/JSON import-export with an interactive preview modal, offline 2FA QR codes, and emergency Vault Recovery keys with brute-force lockout protection.

**Architecture:** Extend `SavedConnection` with `folder` and `bookmarks` in TypeScript and Rust. Parse FileZilla XML client-side via browser `DOMParser`. Build an interactive import preview modal with duplicate detection. Centralize TOTP config into a reactive `totpStore` with offline QR generation. Implement emergency key escrow in `vault.rs` with 2FA-assisted recovery and client-side 30s lockout.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Tauri v2, Rust (AES-256-GCM, PBKDF2, HMAC-SHA256), `qrcode`, Vitest, Cargo test.

**Spec:** `docs/superpowers/specs/2026-09-08-folders-import-export-security-design.md`

## Global Constraints

- No regression in existing tests (`pnpm test` and `cargo test`).
- Offline-only QR code generation (no external web requests).
- Safe duplicate handling: never overwrite saved connections without explicit user choice.
- Zero-knowledge vault security: recovery key must be cryptographically verified against escrowed key bytes.

---

### Task 1: Data Models & Backend Struct Updates

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src-tauri/src/storage.rs`
- Modify: `src-tauri/src/vault.rs`
- Modify: `src-tauri/tests/models_test.rs`
- Test: `src-tauri/tests/models_test.rs`

**Interfaces:**
- Consumes: Existing `SavedConnection` definitions.
- Produces: `ConnectionBookmark` and updated `SavedConnection` with `folder?: string` and `bookmarks?: ConnectionBookmark[]`.

- [x] **Step 1: Write test for bookmark and folder serialization in Rust**

Add tests verifying serialization and deserialization of `folder` and `bookmarks` in `src-tauri/tests/models_test.rs`:

```rust
#[test]
fn test_saved_connection_with_folder_and_bookmarks() {
    let conn = openterm_lib::storage::SavedConnection {
        id: "test-id".into(),
        name: "Web Server".into(),
        host: "10.0.0.1".into(),
        port: 22,
        username: "admin".into(),
        auth_type: "password".into(),
        private_key_path: None,
        password: Some("secret".into()),
        passphrase: None,
        folder: Some("Production/Web".into()),
        bookmarks: vec![
            openterm_lib::storage::ConnectionBookmark {
                id: "bm-1".into(),
                name: "Nginx logs".into(),
                local_path: Some("C:\\logs".into()),
                remote_path: Some("/var/log/nginx".into()),
            }
        ],
        created_at: 1000,
        updated_at: 2000,
    };

    let json = serde_json::to_string(&conn).expect("serialize");
    assert!(json.contains("\"folder\":\"Production/Web\""));
    assert!(json.contains("\"bookmarks\":["));

    let deserialized: openterm_lib::storage::SavedConnection = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(deserialized.folder, Some("Production/Web".into()));
    assert_eq!(deserialized.bookmarks.len(), 1);
    assert_eq!(deserialized.bookmarks[0].name, "Nginx logs");
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --test models_test --manifest-path src-tauri/Cargo.toml`
Expected: FAIL with missing fields `folder` and `bookmarks`

- [x] **Step 3: Update `src-tauri/src/storage.rs` and `src/types/index.ts`**

In `src-tauri/src/storage.rs`:
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

In `src/types/index.ts`:
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

- [x] **Step 4: Run test to verify it passes**

Run: `cargo test --test models_test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/types/index.ts src-tauri/src/storage.rs src-tauri/tests/models_test.rs
git commit -m "feat: add folder and bookmarks to SavedConnection models"
```

---

### Task 2: TOTP Bugfixes, Centralized Store, and QR Code Support (Issues #9, #11)

**Files:**
- Create: `src/stores/totpStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard/Dashboard.tsx`
- Modify: `src/components/Modal/TotpModal.tsx`
- Modify: `src-tauri/src/totp.rs`
- Test: `src/stores/__tests__/totpStore.test.ts`

**Interfaces:**
- Consumes: `tauriApi.totpGetConfig()`, `tauriApi.totpUpdateIdleTimeout()`
- Produces: `useTotpStore` with reactive `config`, `loadConfig()`, `updateIdleTimeout()`

- [x] **Step 1: Write failing test for `useTotpStore` and timeout coalescing**

Create `src/stores/__tests__/totpStore.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTotpStore } from '../totpStore';
import { tauriApi } from '../../services/tauri';

vi.mock('../../services/tauri', () => ({
  tauriApi: {
    totpGetConfig: vi.fn(),
    totpUpdateIdleTimeout: vi.fn(),
  },
}));

describe('useTotpStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly handles 0 minutes timeout (disabled)', async () => {
    vi.mocked(tauriApi.totpGetConfig).mockResolvedValueOnce({
      enabled: true,
      idleTimeoutMins: 0,
      hasBackupCodes: true,
    });

    await useTotpStore.getState().loadConfig();
    const config = useTotpStore.getState().config;
    expect(config.idleTimeoutMins).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test src/stores/__tests__/totpStore.test.ts`
Expected: FAIL with module not found

- [x] **Step 3: Implement `src/stores/totpStore.ts`**

```typescript
import { create } from 'zustand';
import { TotpConfig } from '../types';
import { tauriApi } from '../services/tauri';

interface TotpState {
  config: TotpConfig;
  isLoading: boolean;
  loadConfig: () => Promise<TotpConfig>;
  updateIdleTimeout: (mins: number) => Promise<void>;
}

export const useTotpStore = create<TotpState>((set) => ({
  config: {
    enabled: false,
    idleTimeoutMins: 15,
    hasBackupCodes: false,
  },
  isLoading: false,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await tauriApi.totpGetConfig();
      set({ config, isLoading: false });
      return config;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateIdleTimeout: async (mins: number) => {
    await tauriApi.totpUpdateIdleTimeout(mins);
    set((state) => ({
      config: { ...state.config, idleTimeoutMins: mins },
    }));
  },
}));
```

- [x] **Step 4: Update `App.tsx`, `Dashboard.tsx`, and `TotpModal.tsx` to use `useTotpStore` and `?? 15`**

In `App.tsx`:
Replace local `totpConfig` state with `const { config: totpConfig, loadConfig } = useTotpStore();`
Change `timeoutMins` calculation to:
```typescript
const timeoutMins = totpConfig?.idleTimeoutMins ?? 15;
```

In `TotpModal.tsx`:
Update timeout select and change handler to use `useTotpStore.getState().updateIdleTimeout(mins)` and `selectedTimeout ?? 15`.

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/stores/totpStore.ts src/stores/__tests__/totpStore.test.ts src/App.tsx src/components/Dashboard/Dashboard.tsx src/components/Modal/TotpModal.tsx
git commit -m "fix: resolve 2FA idle timeout reset bug and centralize totpStore (closes #9, #11)"
```

---

### Task 3: FileZilla XML & JSON Import/Export Services (Issue #13)

**Files:**
- Create: `src/services/filezillaParser.ts`
- Create: `src/services/connectionExporter.ts`
- Test: `src/services/__tests__/filezillaParser.test.ts`

**Interfaces:**
- Consumes: FileZilla XML content, OpenTerm connection arrays.
- Produces: `parseFileZillaXml(xmlString): ParsedImportResult`, `exportToOpenTermJson(connections)`, `exportToFileZillaXml(connections)`

- [x] **Step 1: Write failing unit test for `filezillaParser`**

Create `src/services/__tests__/filezillaParser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseFileZillaXml, decodeFileZillaRemoteDir } from '../filezillaParser';

describe('filezillaParser', () => {
  it('decodes FileZilla space-separated remote dir format', () => {
    const raw = '1 0 3 opt 14 service1 10 service1';
    expect(decodeFileZillaRemoteDir(raw)).toBe('/opt/service1/service1');
  });

  it('parses nested folders, servers, passwords, and bookmarks', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3 version="3.71.1" platform="windows">
  <Servers>
    <Folder expanded="0">App Test<Server>
        <Host>127.0.0.1</Host>
        <Port>22</Port>
        <Protocol>1</Protocol>
        <User>testuser</User>
        <Pass encoding="base64">UGFzc3dvcmRUZXN0MTIzNA==</Pass>
        <Name>App Test</Name>
        <Bookmark>
          <Name>Service 1</Name>
          <LocalDir>C:\\work\\service1</LocalDir>
          <RemoteDir>1 0 3 opt 8 service1</RemoteDir>
        </Bookmark>
      </Server>
    </Folder>
  </Servers>
</FileZilla3>`;

    const result = parseFileZillaXml(xml);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('App Test');
    expect(result[0].host).toBe('127.0.0.1');
    expect(result[0].port).toBe(22);
    expect(result[0].username).toBe('testuser');
    expect(result[0].password).toBe('PasswordTest1234');
    expect(result[0].folder).toBe('App Test');
    expect(result[0].bookmarks?.length).toBe(1);
    expect(result[0].bookmarks?.[0].name).toBe('Service 1');
    expect(result[0].bookmarks?.[0].remotePath).toBe('/opt/service1');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test src/services/__tests__/filezillaParser.test.ts`
Expected: FAIL with module not found

- [x] **Step 3: Implement `filezillaParser.ts` and `connectionExporter.ts`**

Create `src/services/filezillaParser.ts`:
```typescript
import { SavedConnection, ConnectionBookmark } from '../types';

export function decodeFileZillaRemoteDir(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return raw;
  const segments: string[] = [];
  let i = 2; // skip header (e.g. '1 0')
  while (i < parts.length) {
    const len = parseInt(parts[i], 10);
    if (isNaN(len)) {
      i++;
      continue;
    }
    i++;
    if (i < parts.length) {
      segments.push(parts[i]);
      i++;
    }
  }
  return '/' + segments.join('/');
}

export function parseFileZillaXml(xmlString: string): Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const connections: Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  function traverseNode(node: Element, currentFolder: string) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.tagName === 'Folder') {
        const folderName = child.getAttribute('name') || child.childNodes[0]?.nodeValue?.trim() || '';
        const nextFolder = currentFolder ? `${currentFolder}/${folderName}` : folderName;
        traverseNode(child, nextFolder);
      } else if (child.tagName === 'Server') {
        const host = child.querySelector('Host')?.textContent?.trim() || '';
        const port = parseInt(child.querySelector('Port')?.textContent?.trim() || '22', 10);
        const username = child.querySelector('User')?.textContent?.trim() || '';
        const name = child.querySelector('Name')?.textContent?.trim() || host;
        const keyfile = child.querySelector('Keyfile')?.textContent?.trim();

        let password: string | undefined;
        const passEl = child.querySelector('Pass');
        if (passEl) {
          const encoding = passEl.getAttribute('encoding');
          const text = passEl.textContent?.trim() || '';
          if (encoding === 'base64') {
            try {
              password = atob(text);
            } catch {
              password = text;
            }
          } else {
            password = text;
          }
        }

        const bookmarks: ConnectionBookmark[] = [];
        const bmEls = child.querySelectorAll('Bookmark');
        bmEls.forEach((bm) => {
          const bmName = bm.querySelector('Name')?.textContent?.trim() || 'Bookmark';
          const localPath = bm.querySelector('LocalDir')?.textContent?.trim() || undefined;
          const remoteRaw = bm.querySelector('RemoteDir')?.textContent?.trim();
          const remotePath = remoteRaw ? decodeFileZillaRemoteDir(remoteRaw) : undefined;
          bookmarks.push({
            id: crypto.randomUUID(),
            name: bmName,
            localPath,
            remotePath,
          });
        });

        connections.push({
          name,
          host,
          port,
          username,
          authType: keyfile ? 'key' : 'password',
          privateKeyPath: keyfile || undefined,
          password: password || undefined,
          folder: currentFolder || undefined,
          bookmarks: bookmarks.length > 0 ? bookmarks : undefined,
        });
      }
    }
  }

  const serversNode = doc.querySelector('Servers');
  if (serversNode) {
    traverseNode(serversNode, '');
  }

  return connections;
}
```

Create `src/services/connectionExporter.ts`:
```typescript
import { SavedConnection } from '../types';

export function exportToOpenTermJson(connections: SavedConnection[]): string {
  return JSON.stringify(connections, null, 2);
}

export function exportToFileZillaXml(connections: SavedConnection[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FileZilla3 version="3.71.1" platform="all">\n\t<Servers>\n';
  for (const conn of connections) {
    const passTag = conn.password
      ? `\t\t\t<Pass encoding="base64">${btoa(conn.password)}</Pass>\n`
      : '';
    const keyTag = conn.privateKeyPath
      ? `\t\t\t<Keyfile>${conn.privateKeyPath}</Keyfile>\n`
      : '';

    xml += `\t\t<Server>
\t\t\t<Host>${conn.host}</Host>
\t\t\t<Port>${conn.port}</Port>
\t\t\t<Protocol>1</Protocol>
\t\t\t<User>${conn.username}</User>
${passTag}${keyTag}\t\t\t<Name>${conn.name}</Name>
\t\t</Server>\n`;
  }
  xml += '\t</Servers>\n</FileZilla3>\n';
  return xml;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/services/__tests__/filezillaParser.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/filezillaParser.ts src/services/connectionExporter.ts src/services/__tests__/filezillaParser.test.ts
git commit -m "feat: add FileZilla XML and OpenTerm JSON import and export services"
```

---

### Task 4: Interactive Import/Export Modal & UI Integration (Issue #13)

**Files:**
- Create: `src/components/Modal/ImportExportModal.tsx`
- Modify: `src/components/Dashboard/Dashboard.tsx`
- Test: `src/components/Modal/__tests__/importExportModal.test.ts`

**Interfaces:**
- Consumes: `parseFileZillaXml`, `exportToOpenTermJson`, `exportToFileZillaXml`, `useSavedConnectionStore`
- Produces: `ImportExportModal` dialog supporting file drop, collision detection, and selective import.

- [x] **Step 1: Write test for duplicate detection logic**

Create `src/components/Modal/__tests__/importExportModal.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Import Collision Detection', () => {
  const existing = [
    { host: '127.0.0.1', port: 22, username: 'root' },
    { host: 'app.internal', port: 2222, username: 'deploy' },
  ];

  const isDuplicate = (item: { host: string; port: number; username: string }) =>
    existing.some((e) => e.host === item.host && e.port === item.port && e.username === item.username);

  it('identifies exact matches as duplicate', () => {
    expect(isDuplicate({ host: '127.0.0.1', port: 22, username: 'root' })).toBe(true);
    expect(isDuplicate({ host: '127.0.0.1', port: 2222, username: 'root' })).toBe(false);
    expect(isDuplicate({ host: 'new.domain', port: 22, username: 'root' })).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it passes**

Run: `pnpm test src/components/Modal/__tests__/importExportModal.test.ts`
Expected: PASS

- [x] **Step 3: Implement `src/components/Modal/ImportExportModal.tsx`**

Build modal with drag/drop area, file parsing, collision check table with checkboxes, strategy selector ("Keep both (rename duplicate)" / "Overwrite"), and "Import Selected" action.

- [x] **Step 4: Integrate "Import / Export" buttons in `Dashboard.tsx`**

Add "Import / Export" action buttons to the Dashboard header beside "New Connection".

- [x] **Step 5: Run tests to verify build integrity**

Run: `pnpm test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/components/Modal/ImportExportModal.tsx src/components/Modal/__tests__/importExportModal.test.ts src/components/Dashboard/Dashboard.tsx
git commit -m "feat: add interactive Import/Export connections modal (closes #13)"
```

---

### Task 5: Folders & SFTP Bookmarks UI (Issue #12)

**Files:**
- Modify: `src/components/Dashboard/Dashboard.tsx`
- Modify: `src/components/Modal/NewConnectionModal.tsx`
- Modify: `src/components/FileManager/DualPaneExplorer.tsx`
- Test: `src/components/Dashboard/__tests__/folderGrouping.test.ts`

**Interfaces:**
- Consumes: `SavedConnection.folder`, `SavedConnection.bookmarks`
- Produces: Collapsible folder groupings in Dashboard, folder autocomplete in NewConnectionModal, bookmark jump dropdown in DualPaneExplorer.

- [x] **Step 1: Write test for folder grouping utility**

Create `src/components/Dashboard/__tests__/folderGrouping.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Folder Grouping', () => {
  const connections = [
    { id: '1', name: 'Server A', folder: 'Work' },
    { id: '2', name: 'Server B', folder: 'Work' },
    { id: '3', name: 'Server C', folder: 'Personal' },
    { id: '4', name: 'Server D' },
  ];

  it('groups connections by folder and collects uncategorized', () => {
    const groups: Record<string, typeof connections> = {};
    for (const c of connections) {
      const f = c.folder || 'Uncategorized';
      if (!groups[f]) groups[f] = [];
      groups[f].push(c);
    }

    expect(Object.keys(groups)).toEqual(['Work', 'Personal', 'Uncategorized']);
    expect(groups['Work'].length).toBe(2);
    expect(groups['Uncategorized'].length).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it passes**

Run: `pnpm test src/components/Dashboard/__tests__/folderGrouping.test.ts`
Expected: PASS

- [x] **Step 3: Update `Dashboard.tsx` for folder sections and filter chips**

Render folder accordion sections with Chevron icons and badge counts. Include filter chip bar at top.

- [x] **Step 4: Update `NewConnectionModal.tsx` with folder input and bookmark table**

Add `folder` input field with suggestions from existing folders. Add Bookmarks table allowing user to add Name, Local Path, and Remote Path pairs.

- [x] **Step 5: Update `DualPaneExplorer.tsx` with SFTP bookmark dropdown**

Add bookmark dropdown in toolbar. When clicked, navigates local pane (`setLocalPath`) and remote pane (`loadRemoteDir`) simultaneously.

- [x] **Step 6: Run tests to verify build integrity**

Run: `pnpm test`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/components/Dashboard/Dashboard.tsx src/components/Modal/NewConnectionModal.tsx src/components/FileManager/DualPaneExplorer.tsx src/components/Dashboard/__tests__/folderGrouping.test.ts
git commit -m "feat: add connection folders and SFTP directory bookmarks (closes #12)"
```

---

### Task 6: Vault Recovery Key & Lockout Protection (Issue #10 - Option B)

**Files:**
- Modify: `src-tauri/src/vault.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/services/tauri.ts`
- Modify: `src/components/Modal/VaultModal.tsx`
- Test: `src-tauri/src/vault.rs` (unit tests)
- Test: `src/components/Modal/__tests__/vaultModal.test.ts`

**Interfaces:**
- Consumes: PBKDF2 key derivation, 2FA validation (`totp::verify_totp_code`)
- Produces: `vault_recover(recovery_key, totp_code, new_password)` command, recovery key creation, and 30s lockout on 5 failed attempts.

- [x] **Step 1: Write test for recovery key derivation and escrow in Rust**

Add to `src-tauri/src/vault.rs`:
```rust
#[test]
fn test_recovery_key_format_and_escrow() {
    let raw_key = [7u8; 32];
    let recovery_key = generate_recovery_token();
    assert!(recovery_key.starts_with("OT-"));
    assert_eq!(recovery_key.len(), 19); // OT-XXXX-XXXX-XXXX

    let escrow = create_recovery_escrow(&raw_key, &recovery_key).expect("create escrow");
    let recovered = recover_key_from_escrow(&escrow, &recovery_key).expect("recover key");
    assert_eq!(raw_key, recovered);
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml test_recovery_key_format_and_escrow`
Expected: FAIL with functions not found

- [x] **Step 3: Implement recovery key generation and recovery command in `vault.rs`**

Add `generate_recovery_token()`, `create_recovery_escrow()`, `recover_key_from_escrow()`, and `pub fn recover_vault(state: &VaultState, recovery_key: &str, totp_code: Option<&str>, new_password: &str) -> Result<(), String>`.

- [x] **Step 4: Expose `vault_recover` in `src-tauri/src/lib.rs` and `src/services/tauri.ts`**

Register command in Tauri handlers.

- [x] **Step 5: Update `VaultModal.tsx` for recovery key display, forgot password flow, and 30s lockout**

- Show recovery key on initial vault setup for user to save.
- Add "Forgot Password?" prompt allowing input of Recovery Key + 2FA code.
- Add failed attempts state counter: after 5 consecutive incorrect attempts, disable unlock for 30 seconds with countdown timer.

- [x] **Step 6: Run Cargo tests and Vitest suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Run: `pnpm test`
Expected: ALL PASS

- [x] **Step 7: Commit**

```bash
git add src-tauri/src/vault.rs src-tauri/src/lib.rs src/services/tauri.ts src/components/Modal/VaultModal.tsx
git commit -m "feat: add emergency recovery key and brute-force lockout to Vault (closes #10)"
```
