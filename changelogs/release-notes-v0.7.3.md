# OpenTerm v0.7.3 Release Notes

OpenTerm v0.7.3 introduces CodeMirror 6 with One Dark theme syntax highlighting for scripts and config files, native OS clipboard file copying and drag-and-drop out to the Desktop/Explorer, persistent SFTP column layouts with middle-truncation, per-session remote path preservation across view switches, and configurable file double-click behavior.

---

## What's New

### 1. In-App CodeMirror 6 & External Editor Sync (#42)
- **CodeMirror 6 Editor**: Replaced standard textarea with full CodeMirror 6 code editor featuring One Dark theme, line numbers, active line gutters, bracket matching, and code folding.
- **Syntax Highlighting**: Built-in support for Shell (`.sh`, `.bash`, `.zsh`, `.env`, shebang lines), Dockerfile, TOML, Nginx, XML/SVG, properties/ini, PowerShell, Lua, Go, Python, JavaScript, TypeScript, Rust, JSON, HTML, CSS, SQL, and Markdown.
- **External Editor Auto-Sync**: Editing remote files externally downloads directly to local cache and monitors saves in the background, automatically syncing edits back over SFTP.
- **Reliable Direct Downloads**: Synchronous download engine ensures files exist on disk before external editors open.

### 2. Native File Clipboard & OS Drag-and-Drop (#43)
- **Native OS File Copying**: `Ctrl+C` and right-click "Copy File" copy actual files to the system clipboard via Win32 `CF_HDROP` format and `Preferred DropEffect`, allowing direct paste into Windows Explorer or Desktop.
- **Remote File Clipboard**: Remote files automatically download synchronously to cache before copying, making OS file paste work seamlessly for remote SFTP files.
- **Drag-and-Drop Out of OpenTerm**: Drag files directly from OpenTerm out to the Windows Desktop or Windows Explorer folders via native OLE drag (`DoDragDrop`).

### 3. Remote Path Preservation Across View Switches (#40)
- **Session-Scoped Navigation History**: Remote paths are now tracked per session. Switching between Terminal, SFTP, and Split views preserves your active remote working directory.
- **Clean Disconnect**: Session paths automatically clean up upon session termination.

### 4. Dynamic Context Menu Viewport Clamping (#41)
- **Smart Positioning**: Context menus flip upwards automatically when near screen edges and maintain a guaranteed 24px clearance above the bottom Status Bar.

### 5. Configurable Double-Click Action (#44)
- **Preference Toggle**: Added a file double-click action setting in Settings > SFTP Explorer (`'transfer' | 'edit'`). Transfer double-click prompts on filename collisions. Directory double-click always navigates.

### 6. Persistent SFTP Columns & 50/50 Split Snap (#45)
- **Persistent Column Widths & Visibility**: Toggle and resize Size and Modified Date columns, stored in `localStorage`.
- **Clean 1px Dividers**: Subtle `#2e3044` column dividers with hover highlighting.
- **Middle Truncation**: Long filenames truncate intelligently in the middle (`name...ext`), keeping compound extensions visible (`.tar.gz`, `.spec.ts`).
- **50/50 Split Snap**: Double-clicking the splitter bar between local and remote panes snaps the split evenly to 50/50.

---

## Verification & Stability
- 268/268 Vitest unit and component tests passing across 41 test suites.
- Clean Tauri/Rust compile (`cargo check`) and Vite bundle build (`npm run build`).
