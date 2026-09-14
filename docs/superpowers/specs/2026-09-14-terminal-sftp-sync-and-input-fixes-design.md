# Bi-directional Terminal-SFTP Synchronization and Input Fixes Specification

## 1. Objectives
- **Fix Duplicate Paste**: Prevent text from pasting twice on `Ctrl+V` and `Win+V` clipboard history.
- **Fix Right-Click Paste Focus Loss**: Restore typing focus to the active terminal instance immediately after context menu actions or closure.
- **Fix Shift + Arrow Key Artifacts**: Intercept Shift + Arrow key combinations (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`) to prevent ANSI escape leakages (`A`, `B`, `C`, `D`) and enable native keyboard text selection.
- **Bi-directional Terminal <-> SFTP Synchronization**:
  - Automatically synchronize directory navigation between the active SSH terminal session and the SFTP remote file manager.
  - Support native OSC 7 terminal directory reporting with fallback manual sync controls and loop guards.

---

## 2. Component & Flow Architecture

### 2.1 Terminal Input & Clipboard Fixes (`useTerminalSession.ts`)
1. **Single Paste Channel**:
   - Remove redundant `tauriApi.sshWrite` call inside the `keydown` event listener for `Ctrl+V` / `Ctrl+Shift+V`.
   - Allow xterm's internal `<textarea>` and DOM `paste` listener to handle clipboard data naturally, or invoke `term.paste(clipText)` once and cancel the default event.
   - Ensure `Win+V` (Windows Clipboard History) events routed via native DOM `paste` do not trigger duplicate calls.
2. **Context Menu Focus Retention (`TerminalView.tsx` & `TerminalContextMenu.tsx`)**:
   - Ensure every context menu action (`onCopy`, `onPaste`, `onSelectAll`, `onClear`, `onReset`, `onClose`) calls `terminal?.focus()` immediately upon completion.
   - Add focus restoration to window click-outside and `Escape` key dismissals.

### 2.2 Shift + Arrow Text Selection (`useTerminalSession.ts`)
1. **Interception**:
   - Detect `event.shiftKey && (event.key.startsWith('Arrow'))` inside `term.attachCustomKeyEventHandler`.
   - Intercept keydown and call `event.preventDefault()` to stop xterm from emitting `\x1b[1;2A`, `\x1b[1;2B`, `\x1b[1;2C`, `\x1b[1;2D`.
2. **Keyboard Selection Engine**:
   - Maintain an active selection anchor in terminal cell coordinates (`col`, `row`).
   - If no selection exists when Shift+Arrow is pressed, anchor at current cursor position (`buffer.active.cursorX`, `buffer.active.cursorY + buffer.active.baseY`).
   - On `Shift+ArrowLeft`: expand selection leftward (or shrink if anchored right).
   - On `Shift+ArrowRight`: expand selection rightward.
   - On `Shift+ArrowUp` / `Shift+ArrowDown`: expand/shrink selection across lines.
   - Call `term.select(startCol, startRow, length)` to update xterm visual selection.
   - If arrow keys are pressed without Shift, reset anchor and clear selection (`term.clearSelection()`).

### 2.3 Bi-directional Terminal <-> SFTP Synchronization

```
+-----------------------------------------------------------+
|                       OpenTerm GUI                        |
|                                                           |
|  +--------------------+           +--------------------+  |
|  |    TerminalView    |           |  DualPaneExplorer  |  |
|  |  (xterm.js instance|           |    (SFTP Remote)   |  |
|  +---------+----------+           +---------+----------+  |
|            |                                |             |
|    OSC 7   |                                |  Remote Nav |
|   Report   |                                |  Action     |
|            v                                v             |
|   +--------------------------------------------------+    |
|   |         Sync Guard & Dispatcher Manager          |    |
|   |   - lastSyncedPathRef (Loop Breaker)             |    |
|   |   - syncEnabled: boolean (Local Storage setting) |    |
|   +--------+---------------------------------+-------+    |
|            |                                 |            |
|            | loadRemoteDir(path)             | cd -- "path"|
|            v                                 v            |
|  +--------------------+           +--------------------+  |
|  |  fileManagerStore  |           | tauriApi.sshWrite  |  |
|  +--------------------+           +--------------------+  |
+-----------------------------------------------------------+
```

#### 2.3.1 Terminal -> SFTP (OSC 7 Parsing)
- Register custom OSC handler with xterm: `term.parser.registerOscHandler(7, (data) => boolean)`.
- Parse incoming OSC 7 payload:
  - Standard format: `file://<hostname>/<path>` or direct POSIX path `/<path>`.
  - Strip `file://<hostname>` prefix and decode URI components (`decodeURIComponent`).
  - Validate that target is a valid remote POSIX absolute path.
- Check sync state:
  - If target path equals `remote.currentPath` or matches `lastSyncedPathRef`, ignore to break potential feedback loops.
  - Otherwise, update `lastSyncedPathRef` and call `loadRemoteDir(sessionId, normalizedPath)`.

#### 2.3.2 SFTP -> Terminal (Automatic `cd` Dispatch)
- In `DualPaneExplorer.tsx` or `fileManagerStore`, when remote directory path changes:
  - If auto-sync toggle is active:
    - Check if the change originated from an OSC 7 terminal sync. If so, skip.
    - Format safe command: `cd -- "<escaped_remote_path>"\r`.
    - Update `lastSyncedPathRef` to avoid bouncing back via OSC 7.
    - Dispatch command to terminal PTY via `tauriApi.sshWrite(sessionId, command)`.

#### 2.3.3 UI Controls & Fallback
- Add auto-sync toggle switch to SFTP remote path bar:
  - Tooltip: "Auto-sync directory with terminal".
  - Persisted in localStorage (`openterm_sftp_auto_sync`).
- Add "Sync from Terminal" refresh icon button in SFTP toolbar:
  - On click: queries or prompts terminal sync if remote shell lacks OSC 7.

---

## 3. Edge Cases & Safeguards
1. **Feedback Loop Prevention**:
   - Strict `lastSyncedPath` guard prevents Terminal -> SFTP -> Terminal infinite command loops.
   - Debounce window (150ms) suppresses rapid duplicate events.
2. **Command Injection Protection**:
   - Remote path is sanitized: POSIX double-dash `cd -- "..."` used to prevent parameter injection (e.g., paths beginning with `-`).
   - Quotes and special characters in paths are properly escaped.
3. **Running Shell Programs Warning / Safety**:
   - Only execute `cd` when terminal session is connected.
   - Provide toggle to disable auto-sync when working extensively in interactive TUI applications (`vim`, `nano`).

---

## 4. Verification Plan
1. **Clipboard**:
   - Press `Ctrl+V` with clipboard text `"12345"` -> verify terminal receives exactly `"12345"`.
   - Open Windows Clipboard (`Win+V`), select item -> verify no duplication.
   - Right-click terminal -> click "Paste" -> verify pasted text appears and cursor continues receiving keystrokes without clicking to refocus.
2. **Shift + Arrow Selection**:
   - Press `Shift+Right`, `Shift+Left`, `Shift+Down`, `Shift+Up` at prompt -> verify no `A`, `B`, `C`, `D` characters are printed.
   - Verify text under cursor is highlighted and can be copied via `Ctrl+C`.
3. **Bi-directional Directory Sync**:
   - Double-click folder `/var/log` in SFTP -> verify terminal runs `cd -- "/var/log"` and reaches `/var/log`.
   - In terminal, execute `cd /tmp` (on host supporting OSC 7) -> verify SFTP file pane updates to `/tmp`.
   - Toggle off auto-sync -> verify SFTP changes do not dispatch `cd` commands.
