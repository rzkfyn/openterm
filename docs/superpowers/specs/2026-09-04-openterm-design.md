# Architecture Design: Unified SSH & SFTP Client (OpenTerm)

## Overview
OpenTerm is a lightweight desktop SSH terminal and SFTP dual-pane file manager built on Tauri 2, React 19, TypeScript, Tailwind CSS v4, Zustand, and xterm.js. The primary architectural objective is strict memory containment (80MB to 150MB footprint) while providing responsive terminal streaming and high-capacity file browsing/transfers.

## Global Constraints & Spec Adherence
- **Core Framework**: Tauri 2
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Terminal Emulator**: xterm.js (+ addons: fit, web-links)
- **Backend Systems**: Rust (handling networking, IPC, SFTP, and OS-level APIs)
- **SSH / SFTP Backend Engine**: `ssh2` crate (libssh2 bindings) or `russh`
- **Data Streaming Rule**: PTY data streamed from Rust to frontend via Tauri event emission (`ssh:data:{session_id}`) rather than standard invoke polling.
- **Binary Handling Rule**: File binaries must NEVER touch JavaScript memory. Disk-to-socket and socket-to-disk streaming occurs exclusively in Rust. Only lightweight progress events are emitted to the webview.
- **Pagination Rule**: Large directory listings are chunked/paginated across IPC to protect Tauri serialization buffers.
- **Virtualization Rule**: Remote and local directory views must be virtualized using `@tanstack/react-virtual`.

---

## Subsystem Architecture

### 1. Rust Backend Architecture (`src-tauri`)

#### 1.1 State & Session Management
- `SessionManager`: Thread-safe struct (`Arc<Mutex<HashMap<String, SshSessionState>>>`) managed in Tauri state.
- `SshSessionState`:
  - `session_id`: Unique UUID/string
  - `tcp_stream`: `std::net::TcpStream`
  - `ssh_session`: `ssh2::Session`
  - `channel`: Arc/Mutex wrapped `ssh2::Channel` (for interactive shell PTY)
  - `sftp`: Arc/Mutex wrapped `ssh2::Sftp` (for SFTP operations)
  - `pty_sender`: Crossbeam or mpsc channel to write user keystrokes into the SSH channel
  - `shutdown_signal`: AtomicBool or channel to terminate reader threads cleanly

#### 1.2 SSH Terminal Streaming (PTY)
- When a session is initiated:
  1. Authenticate with Password or Private Key.
  2. Request a PTY (`vanilla`, `xterm-256color`, cols, rows).
  3. Spawn a dedicated OS/tokio worker thread that reads from `channel.read()`.
  4. Stream chunks as UTF-8 or base64/binary payloads via `app_handle.emit(&format!("ssh:data:{}", session_id), chunk)`.
  5. Tauri command `ssh_write(session_id, data: Vec<u8> | String)` writes directly to the channel.
  6. Tauri command `ssh_resize(session_id, cols: u32, rows: u32)` issues `channel.request_pty_size()`.

#### 1.3 SFTP File Operations (Zero-Binary-In-JS)
- **Directory Traversal**:
  - Command `sftp_list_dir(session_id, remote_path, offset, limit) -> PaginatedEntries`
  - `PaginatedEntries { entries: Vec<FileEntry>, total: usize, has_more: bool }`
  - FileEntry attributes: name, path, size, is_dir, is_symlink, modified, permissions.
  - Sorting and filtering done either on chunk or cached in Rust state per directory session.
- **Local Directory Traversal**:
  - Command `local_list_dir(local_path, offset, limit) -> PaginatedEntries`
- **Direct-to-Disk Transfers**:
  - Command `sftp_download_file(session_id, remote_path, local_path, transfer_id)`
  - Command `sftp_upload_file(session_id, local_path, remote_path, transfer_id)`
  - Streaming loop in Rust uses a buffered reader/writer (64KB - 256KB buffer).
  - Emits events: `transfer:progress:{transfer_id}`:
    `{ transfer_id, file_name, bytes_transferred, total_bytes, percentage, status }`
  - Supports cancel signal via `transfer_cancel(transfer_id)`.

---

### 2. Frontend Architecture (`src/`)

#### 2.1 State Architecture (Zustand Stores)
1. `useSessionStore`:
   - Active sessions list, current active session ID, connection profiles (saved hosts, credentials, keys).
2. `useTerminalStore`:
   - Connection status, active tabs, font settings, terminal themes.
3. `useFileManagerStore`:
   - Local directory state: `currentPath`, `items`, `selectedItems`, `history`, `isLoading`.
   - Remote directory state: `currentPath`, `items`, `selectedItems`, `history`, `isLoading`.
   - View mode: Split view (Local + Remote), Terminal only, or File Manager only.
4. `useTransferStore`:
   - Active, completed, and queued transfers, progress metrics, transfer cancellation triggers.

#### 2.2 UI Component Hierarchy
```
App
├── Header / TopNav (Session Switcher, Connection Dialog, Split View Toggles)
├── MainContent
│   ├── TerminalPane (rendered when active tab is Terminal or Split)
│   │   └── XtermView (xterm.js instance with ResizeObserver & FitAddon)
│   └── FileExplorerPane (rendered when active tab is SFTP or Split)
│       ├── LocalExplorer (Breadcrumb, Toolbar, VirtualizedFileList)
│       └── RemoteExplorer (Breadcrumb, Toolbar, VirtualizedFileList)
├── TransferDrawer / StatusBar (Active transfer progress bars, speed, memory meter)
└── Modals
    └── NewConnectionModal (Host, Port, User, AuthType: Password/Key, KeyPath/Passphrase)
```

#### 2.3 Virtualization Strategy
- `@tanstack/react-virtual` handles virtual rendering for file panes.
- Files are rendered in rows with fixed row heights (e.g. 36px).
- Only visible rows are in the DOM, preventing memory ballooning on 10,000+ file folders.

---

### 3. Error Handling & Edge Cases
- **Connection Drop**: Rust worker detects EOF or socket break, emits `ssh:closed:{session_id}`, frontend transitions state and prompts reconnect.
- **Permission Errors (SFTP)**: Clean errors returned as Result<T, String> across IPC, displayed via toast/status banner.
- **Large Directory Paging**: Frontend requests next offset when user scrolls near the end of loaded virtual items.
- **Transfer Cancellation**: Atomic flag in Rust stops the buffer loop and cleans up incomplete destination files if requested.

---

### 4. Testing Strategy
- **Rust Unit Tests**:
  - Directory pagination unit tests.
  - Path normalization and safety checks (prevent directory traversal exploits).
  - Transfer progress calculation logic.
- **Frontend Unit Tests**:
  - Zustand store actions (navigation, selection, transfer queue).
  - File size and permission formatting utilities.
- **Integration & E2E Validation**:
  - Verification of Tauri IPC commands and event payloads.
  - Memory profiling verification under heavy terminal buffer scroll and large file streaming.
