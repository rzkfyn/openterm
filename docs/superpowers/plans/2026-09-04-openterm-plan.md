# OpenTerm (Unified SSH & SFTP Client) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-performance, lightweight (80-150MB footprint) desktop SSH terminal and SFTP dual-pane file manager using Tauri 2, React 19, Tailwind CSS v4, Zustand, xterm.js, and Rust.

**Architecture:** Rust backend manages SSH connections (`ssh2`), interactive PTY streaming directly to xterm.js via Tauri event emitters, chunked SFTP directory listings, and zero-binary direct-to-disk file transfers. React 19 frontend uses Zustand for state orchestration, `@tanstack/react-virtual` for DOM memory containment, and Tailwind v4 for modern responsive dual-pane views.

**Tech Stack:**
- Tauri 2 (`@tauri-apps/api`, `@tauri-apps/plugin-shell`, `tauri` crate)
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Zustand v5
- xterm.js + `@xterm/addon-fit` + `@xterm/addon-web-links`
- `@tanstack/react-virtual`
- Rust crates: `ssh2`, `tokio`, `serde`, `serde_json`, `uuid`, `crossbeam-channel`

**Spec:** `docs/superpowers/specs/2026-09-04-openterm-design.md`

## Global Constraints
- Core Framework: Tauri 2
- Frontend UI: React 19 + TypeScript + Vite
- Styling: Tailwind CSS v4
- State Management: Zustand
- Terminal: xterm.js with streaming over Tauri events (`ssh:data:{session_id}`)
- Binary Handling Rule: File data must never pass through JS memory (disk-to-disk SFTP in Rust)
- Directory Pagination Rule: Remote/local listings chunked across IPC
- Virtualization Rule: File lists rendered with `@tanstack/react-virtual`
- Memory target: strict 80MB - 150MB idle/active footprint

---

### Task 1: Initialize Tauri 2 + Vite + React 19 + Tailwind CSS v4 Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`

**Interfaces:**
- Produces: Working development scaffold verifiable via `bun run build` and `cargo check` inside `src-tauri`.

- [ ] **Step 1: Create package.json and install frontend dependencies**
- [ ] **Step 2: Configure Vite with React 19 and Tailwind CSS v4**
- [ ] **Step 3: Setup Tauri 2 Cargo.toml and tauri.conf.json**
- [ ] **Step 4: Verify build works for frontend (`bun run build`) and rust backend (`cargo check`)**
- [ ] **Step 5: Commit scaffold**

---

### Task 2: Core Data Types & Rust Session Architecture

**Files:**
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/session.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/models_test.rs`

**Interfaces:**
- Produces: `SessionConfig`, `FileEntry`, `PaginatedEntries`, `TransferProgress`, and thread-safe `SessionManager` struct.

- [ ] **Step 1: Write test for models and serialization in Rust**
- [ ] **Step 2: Implement data structures in `models.rs`**
- [ ] **Step 3: Implement `SessionManager` in `session.rs` for holding active SSH/SFTP sessions**
- [ ] **Step 4: Run `cargo test` to verify models and state logic**
- [ ] **Step 5: Commit**

---

### Task 3: SSH Terminal Connection & PTY Event Streaming Engine

**Files:**
- Create: `src-tauri/src/ssh.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/session.rs`

**Interfaces:**
- Produces Tauri commands:
  - `ssh_connect(config: SessionConfig) -> Result<String, String>`
  - `ssh_disconnect(session_id: String) -> Result<(), String>`
  - `ssh_write(session_id: String, data: String) -> Result<(), String>`
  - `ssh_resize(session_id: String, cols: u32, rows: u32) -> Result<(), String>`
- Produces Tauri Events:
  - `ssh:data:{session_id}` (payload: String)
  - `ssh:status:{session_id}` (payload: StatusEvent)

- [ ] **Step 1: Implement SSH connection with password & public key authentication using `ssh2`**
- [ ] **Step 2: Implement PTY reader thread streaming raw bytes to Tauri events**
- [ ] **Step 3: Implement input writing and window resizing commands**
- [ ] **Step 4: Verify compilation and tests with `cargo test`**
- [ ] **Step 5: Commit**

---

### Task 4: SFTP File Traversal & Zero-Binary Transfer Backend

**Files:**
- Create: `src-tauri/src/sftp.rs`
- Create: `src-tauri/src/local_fs.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces Tauri commands:
  - `local_list_dir(path: String, offset: usize, limit: usize) -> Result<PaginatedEntries, String>`
  - `sftp_list_dir(session_id: String, remote_path: String, offset: usize, limit: usize) -> Result<PaginatedEntries, String>`
  - `sftp_download(session_id: String, remote_path: String, local_path: String, transfer_id: String) -> Result<(), String>`
  - `sftp_upload(session_id: String, local_path: String, remote_path: String, transfer_id: String) -> Result<(), String>`
  - `sftp_cancel_transfer(transfer_id: String) -> Result<(), String>`
- Produces Tauri Events:
  - `transfer:progress:{transfer_id}` (payload: TransferProgress)

- [ ] **Step 1: Implement `local_fs.rs` for chunked local directory reading**
- [ ] **Step 2: Implement `sftp.rs` for chunked remote directory reading via libssh2 SFTP**
- [ ] **Step 3: Implement disk-to-disk streaming download & upload with progress event emission**
- [ ] **Step 4: Implement cancellation mechanism using atomic cancellation tokens**
- [ ] **Step 5: Verify tests with `cargo test` and commit**

---

### Task 5: Frontend Zustand Stores & IPC Service Layer

**Files:**
- Create: `src/types/index.ts`
- Create: `src/services/tauri.ts`
- Create: `src/stores/sessionStore.ts`
- Create: `src/stores/fileManagerStore.ts`
- Create: `src/stores/transferStore.ts`
- Test: `src/stores/__tests__/stores.test.ts`

**Interfaces:**
- Produces: Type-safe Zustand stores and Tauri wrapper functions for terminal and file interactions.

- [ ] **Step 1: Define TypeScript interfaces in `src/types/index.ts`**
- [ ] **Step 2: Build `src/services/tauri.ts` IPC & event bridge**
- [ ] **Step 3: Implement `sessionStore`, `fileManagerStore`, and `transferStore`**
- [ ] **Step 4: Add store unit tests and verify with test runner**
- [ ] **Step 5: Commit**

---

### Task 6: Terminal UI Component (xterm.js + Event Hook)

**Files:**
- Create: `src/components/Terminal/TerminalView.tsx`
- Create: `src/components/Terminal/useTerminalSession.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: Full terminal viewport with auto-fit resizing, web links support, dark mode styling, and event streaming.

- [ ] **Step 1: Implement `useTerminalSession` hook to bind Tauri `ssh:data` events to `xterm.Terminal`**
- [ ] **Step 2: Build `TerminalView` component with `xterm-addon-fit` and resize listeners**
- [ ] **Step 3: Verify terminal rendering and key capture**
- [ ] **Step 4: Commit**

---

### Task 7: Dual-Pane SFTP Explorer with Virtualization

**Files:**
- Create: `src/components/FileManager/DualPaneExplorer.tsx`
- Create: `src/components/FileManager/FilePane.tsx`
- Create: `src/components/FileManager/FileItemRow.tsx`
- Create: `src/components/FileManager/PathBreadcrumb.tsx`
- Create: `src/components/FileManager/TransferDrawer.tsx`

**Interfaces:**
- Produces: Dual-pane local/remote file browser with `@tanstack/react-virtual` virtualization, breadcrumbs, multi-select, and drag-and-drop or transfer buttons.

- [ ] **Step 1: Implement `PathBreadcrumb` and file action toolbar**
- [ ] **Step 2: Implement virtualized `FilePane` rendering thousands of files smoothly**
- [ ] **Step 3: Implement `DualPaneExplorer` combining Local & Remote panes**
- [ ] **Step 4: Implement `TransferDrawer` showing live file transfer progress bars**
- [ ] **Step 5: Commit**

---

### Task 8: Shell Integration, Connection Dialog & End-to-End Polish

**Files:**
- Create: `src/components/Modal/NewConnectionModal.tsx`
- Create: `src/components/Layout/AppHeader.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: Complete, polished desktop application with connection profile modal, split/tab view switching, and memory footprint validation.

- [ ] **Step 1: Implement `NewConnectionModal` with password and private key options**
- [ ] **Step 2: Implement `AppHeader` with session tabs, connection manager button, and view mode toggle (Terminal, SFTP, Split View)**
- [ ] **Step 3: Assemble integrated views in `src/App.tsx`**
- [ ] **Step 4: Run end-to-end linting, typing, frontend build, and cargo checks**
- [ ] **Step 5: Commit and verify documentation**
