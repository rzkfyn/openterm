# OpenTerm Issues #21 to #28 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve critical terminal overflow and copy/paste bugs (#21, #22, #26), fix update notification false positives (#23), implement FileZilla-style directory tree with multi-axis resizing (#24), add raw path editing and mouse history navigation (#25), enable in-session SFTP bookmarking (#28), and provide color theme presets (#27).

**Architecture:**
1. **Terminal:** Intercept keyboard events in `xterm.js` via `attachCustomKeyEventHandler` for `Ctrl+C` / `Ctrl+Shift+C` (copy) and `Ctrl+V` (paste). Wrap terminal viewport in strict `min-h-0 overflow-hidden` without container padding to ensure `fitAddon` row calculations match visible DOM bounds. Intercept DECSET mouse reporting and auxiliary clicks to prevent garbage ANSI codes.
2. **Update Checker:** Invalidate cached update state when `currentVersion === latestVersion` and add visual check status states.
3. **SFTP Navigation & Bookmarks:** Add back/forward history stacks per pane with Mouse 4/5 and keyboard shortcut support. Show raw editable path with instant copy. Allow bookmarking current directory pairs and context menu folder bookmarking, persisted to `savedConnectionStore`.
4. **FileZilla SFTP Layout:** Introduce `DirectoryTree` component for collapsible folder hierarchy above file listings. Implement synchronized horizontal resizing (local vs remote) and independent vertical resizing (tree vs file table). Relocate `TransferDrawer` inside the SFTP workspace container.
5. **Theming:** Create `themeStore` with built-in presets (Midnight, Dracula, One Dark, Nord, Solarized Dark) dynamically updating xterm palette and UI accents.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zustand, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `@tanstack/react-virtual`, Lucide icons, Vitest.

**Spec / Issues:**
- GitHub #21: Terminal text visual overflow under status bar and prompt line overlap
- GitHub #22: Terminal copy does not work (Ctrl+Shift+C) and clicking terminal generates random escape text
- GitHub #23: Update notification displays when running latest version (false positive)
- GitHub #24: FileZilla-style dual directory tree layout with independent resizing for SFTP
- GitHub #25: Raw editable path view and mouse/keyboard history navigation in SFTP
- GitHub #26: Direct clipboard paste (Ctrl+V) and terminal context menu
- GitHub #27: Color theme presets and customization
- GitHub #28: Add and manage SFTP folder bookmarks directly from file manager

---

## Global Constraints
- Zero binary data in JavaScript: all SFTP payload transfers stay disk-to-socket in Rust backend.
- Cross-platform paths: always use `getBasename`, `joinLocalPath`, and `joinRemotePath` from `src/utils/pathUtils.ts`.
- Never store passwords or private keys in plaintext.
- Strict layout isolation: flex containers embedding xterm must have `min-h-0` and `overflow-hidden` to avoid layout breaks on resize.

---

## Phase 1: Terminal & Update Bug Fixes (Issues #21, #22, #23, #26)

### Task 1: Terminal Viewport Overflow and Prompt Line Overlap (#21)

**Files:**
- Modify: `src/components/Terminal/TerminalView.tsx`
- Modify: `src/components/Terminal/useTerminalSession.ts`

**Interfaces:**
- Consumes: `fitAddon.fit()`, `tauriApi.sshResizePty(sessionId, cols, rows)`.
- Produces: Strict zero-padding terminal container that reports exact row counts to PTY.

- [ ] **Step 1: Inspect and fix container layout in `TerminalView.tsx`**

Remove outer padding `p-2.5` from the terminal wrapper div. Ensure parent containers have `min-h-0 flex-1 overflow-hidden`:

```tsx
// src/components/Terminal/TerminalView.tsx
<div
  className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#13131d] cursor-text"
  ref={containerRef}
  onClick={() => terminal?.focus()}
/>
```

- [ ] **Step 2: Debounce and synchronize PTY resize on initial mount in `useTerminalSession.ts`**

In `useTerminalSession.ts`, execute `fitAddon.fit()` inside a double `requestAnimationFrame` to ensure font metrics and container dimensions have stabilized before calling `tauriApi.sshResizePty`:

```ts
const sendResize = () => {
  try {
    if (!containerRef.current || !terminalRef.current || !fitAddonRef.current) return;
    fitAddonRef.current.fit();
    const { cols, rows } = terminalRef.current;
    if (cols > 0 && rows > 0) {
      tauriApi.sshResizePty(sessionId, cols, rows).catch(() => {});
    }
  } catch {
    // ignore layout races during unmount
  }
};

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    sendResize();
    terminalRef.current?.focus();
  });
});
```

- [ ] **Step 3: Test terminal height calculation**

Verify that typing `clear` or running commands that fill the screen stops exactly before the status bar, and prompt text does not overlap previous rows.

- [ ] **Step 4: Commit**

```bash
git add src/components/Terminal/TerminalView.tsx src/components/Terminal/useTerminalSession.ts
git commit -m "fix(terminal): eliminate viewport overflow and fix resize calculation (#21)"
```

---

### Task 2: Terminal Copy/Paste Shortcuts, Context Menu & Mouse Click Fix (#22, #26)

**Files:**
- Create: `src/components/Terminal/TerminalContextMenu.tsx`
- Modify: `src/components/Terminal/useTerminalSession.ts`
- Modify: `src/components/Terminal/TerminalView.tsx`

**Interfaces:**
- Consumes: `navigator.clipboard.readText()`, `navigator.clipboard.writeText()`, `tauriApi.sshWrite()`.
- Produces: `attachCustomKeyEventHandler` handling `Ctrl+C` (copy if selection), `Ctrl+Shift+C` (copy), `Ctrl+V` (paste from clipboard). Right-click context menu with Copy, Paste, Clear, Reset.

- [ ] **Step 1: Add custom key event handler in `useTerminalSession.ts`**

Register `term.attachCustomKeyEventHandler`:
- If `Ctrl+C` or `Ctrl+Shift+C` with active selection: copy selection to clipboard via `navigator.clipboard.writeText(term.getSelection())`, return `false` (do not send SIGINT if selection exists and Shift is pressed).
- If `Ctrl+V`: read clipboard via `navigator.clipboard.readText()` and write to PTY via `tauriApi.sshWrite(sessionId, text)`, return `false`.

```ts
term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  // Copy: Ctrl+Shift+C or Ctrl+C when selection is not empty
  if (event.type === 'keydown' && isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) {
    if (event.shiftKey || term.hasSelection()) {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
        return false;
      }
    }
  }

  // Paste: Ctrl+V
  if (event.type === 'keydown' && isCtrlOrCmd && !event.shiftKey && (event.key === 'v' || event.key === 'V')) {
    navigator.clipboard.readText().then((clipText) => {
      if (clipText && sessionId) {
        tauriApi.sshWrite(sessionId, clipText).catch(() => {});
      }
    }).catch(() => {});
    return false;
  }

  return true;
});
```

- [ ] **Step 2: Suppress unintended middle click and handle context menu in `TerminalView.tsx`**

Prevent middle-click (`auxclick` with `button === 1`) from pasting garbage coordinates or text. Open custom context menu on right click:

```tsx
// src/components/Terminal/TerminalContextMenu.tsx
export interface TerminalContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onReset: () => void;
  onClose: () => void;
}
```

- [ ] **Step 3: Test copy, paste, and right click in terminal**

1. Select text -> Press `Ctrl+Shift+C` -> Paste in external app (verify clipboard contains text).
2. Copy external text -> Focus terminal -> Press `Ctrl+V` (verify text arrives at shell prompt).
3. Right click terminal -> Click "Copy" or "Paste" -> Verify actions work.

- [ ] **Step 4: Commit**

```bash
git add src/components/Terminal/TerminalContextMenu.tsx src/components/Terminal/TerminalView.tsx src/components/Terminal/useTerminalSession.ts
git commit -m "feat(terminal): add copy/paste shortcuts, context menu, and fix mouse click artifacts (#22, #26)"
```

---

### Task 3: Update Checker Cache Invalidation & Manual Check UI (#23)

**Files:**
- Modify: `src/services/updateChecker.ts`
- Modify: `src/stores/updateStore.ts`
- Modify: `src/components/Layout/StatusBar.tsx`
- Test: `src/services/__tests__/updateChecker.test.ts`

**Interfaces:**
- Consumes: `APP_VERSION`, GitHub release API.
- Produces: Invalidation of cached update when `latestVersion === currentVersion`, and manual check status toast/badge.

- [ ] **Step 1: Write unit test for semver equality and cache invalidation**

In `src/services/__tests__/updateChecker.test.ts`, add tests:
- `isNewerVersion('0.5.5', '0.5.5')` must return `false`.
- `isNewerVersion('0.5.0', '0.5.5')` must return `false`.
- `isNewerVersion('0.5.6', '0.5.5')` must return `true`.
- Cache with `hasUpdate: true` where `latestVersion === currentVersion` is cleared.

- [ ] **Step 2: Fix semver logic in `src/services/updateChecker.ts`**

Update `checkLatestRelease`:
```ts
if (latestVersion === currentVersion || !isNewerVersion(latestVersion, currentVersion)) {
  const info: UpdateInfo = {
    hasUpdate: false,
    currentVersion,
    latestVersion,
    releaseUrl,
  };
  localStorage.setItem('openterm_cached_update_info', JSON.stringify(info));
  return info;
}
```

- [ ] **Step 3: Update `StatusBar.tsx` with manual check feedback**

Display an interactive "Check for updates" item or toast tooltip showing "Up to date (vX.X.X)" when checked manually and no update is found.

- [ ] **Step 4: Run unit tests**

Run: `vitest run src/services/__tests__/updateChecker.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/updateChecker.ts src/stores/updateStore.ts src/components/Layout/StatusBar.tsx src/services/__tests__/updateChecker.test.ts
git commit -m "fix(update): fix false-positive update notification and add manual check feedback (#23)"
```

---

## Phase 2: SFTP History Navigation, Raw Path & Live Bookmarks (#25, #28)

### Task 4: SFTP Directory Navigation History & Mouse Buttons (#25)

**Files:**
- Modify: `src/stores/fileManagerStore.ts`
- Modify: `src/components/FileManager/FilePane.tsx`

**Interfaces:**
- Consumes: `loadLocalDir`, `loadRemoteDir`.
- Produces: `history: string[]`, `historyIndex: number`, `navigateBack()`, `navigateForward()`, mouse button 3/4 handler.

- [ ] **Step 1: Add history stacks to `fileManagerStore.ts`**

Extend `PaneState`:
```ts
interface PaneState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  // ... existing fields
}
```
Add methods `goBack(isRemote, sessionId?)` and `goForward(isRemote, sessionId?)`.

- [ ] **Step 2: Hook mouse buttons and shortcuts in `FilePane.tsx`**

In `FilePane.tsx`:
- Listen to `onMouseDown` / `onPointerDown`:
  - `e.button === 3` -> navigate back.
  - `e.button === 4` -> navigate forward.
- In `handleKeyDown`:
  - `Alt + ArrowLeft` -> navigate back.
  - `Alt + ArrowRight` -> navigate forward.

- [ ] **Step 3: Test pane history navigation**

Navigate through 3 folders -> Click mouse back button or press `Alt+Left` -> Pane returns to previous folder.

- [ ] **Step 4: Commit**

```bash
git add src/stores/fileManagerStore.ts src/components/FileManager/FilePane.tsx
git commit -m "feat(sftp): add directory navigation history and mouse back/forward support (#25)"
```

---

### Task 5: Raw Editable Path View (#25)

**Files:**
- Modify: `src/components/FileManager/PathBreadcrumb.tsx`

**Interfaces:**
- Consumes: `currentPath`, `onNavigate`.
- Produces: Default raw path string input with instant copy button and Enter to submit.

- [ ] **Step 1: Update `PathBreadcrumb.tsx` to display direct raw path input by default**

Provide an input displaying the full plain path (e.g. `D:\Spring Boot Projects\VA\docs` or `/home/ubuntu`) with:
- One-click copy path button.
- Direct typing with Enter to jump.
- Breadcrumb toggle button for users who still want segmented breadcrumbs.

- [ ] **Step 2: Test raw path navigation**

Type path into raw input -> Press Enter -> Pane navigates to entered path.

- [ ] **Step 3: Commit**

```bash
git add src/components/FileManager/PathBreadcrumb.tsx
git commit -m "feat(sftp): provide raw editable path bar with one-click copy (#25)"
```

---

### Task 6: SFTP Live Folder Bookmarking & Profile Persistence (#28)

**Files:**
- Modify: `src/components/FileManager/DualPaneExplorer.tsx`
- Modify: `src/components/FileManager/ContextMenu.tsx`
- Modify: `src/stores/savedConnectionStore.ts`
- Modify: `src/stores/sessionStore.ts`

**Interfaces:**
- Consumes: `savedConnectionStore.save()`, `useSessionStore.activeSessions`.
- Produces: Add bookmark button (always visible), "Bookmark Current Folders" modal prompt, and context menu "Add to Bookmarks".

- [ ] **Step 1: Always show bookmark toolbar in `DualPaneExplorer.tsx`**

Remove the `bookmarks.length > 0 &&` condition. In the bookmark dropdown, add:
- "⭐ Bookmark Current Locations" option: prompts user for label name, creates `ConnectionBookmark` with `localPath: local.currentPath, remotePath: remote.currentPath`.
- Auto-saves the updated bookmarks array to `savedConnectionStore` for the active profile so it persists permanently.

- [ ] **Step 2: Add "Add to Bookmarks" in folder context menu (`ContextMenu.tsx`)**

When right-clicking a folder entry, add "Add to Bookmarks" option.

- [ ] **Step 3: Test bookmark creation and recall**

Connect to session -> Click Bookmark button -> Click "Bookmark Current Locations" -> Enter "Web Root" -> Verify bookmark appears in dropdown and survives app restart.

- [ ] **Step 4: Commit**

```bash
git add src/components/FileManager/DualPaneExplorer.tsx src/components/FileManager/ContextMenu.tsx src/stores/savedConnectionStore.ts
git commit -m "feat(sftp): allow bookmarking current folders and persist to connection profile (#28)"
```

---

## Phase 3: FileZilla Dual Directory Tree & Multi-Axis Resizing (#24)

### Task 7: Collapsible Directory Tree Component (#24)

**Files:**
- Create: `src/components/FileManager/DirectoryTree.tsx`
- Modify: `src/stores/fileManagerStore.ts`
- Modify: `src/services/tauri.ts` (if additional tree listing helper needed)

**Interfaces:**
- Consumes: `tauriApi.localListDir`, `tauriApi.sftpListDir`.
- Produces: Expandable folder tree component showing folders only, with click-to-select folder.

- [ ] **Step 1: Create `DirectoryTree.tsx`**

Build a lightweight tree viewer that loads subfolders on node expansion:
- Root drives / root folder (`/` or Windows drives).
- Expand/collapse chevrons.
- Selection triggers `onSelectFolder(path)` which updates the file table below.

- [ ] **Step 2: Add directory tree state to `fileManagerStore.ts`**

Store expanded tree nodes per pane to retain tree state when browsing.

- [ ] **Step 3: Commit**

```bash
git add src/components/FileManager/DirectoryTree.tsx src/stores/fileManagerStore.ts
git commit -m "feat(sftp): add collapsible directory tree component (#24)"
```

---

### Task 8: Multi-Axis Resizing & Docked SFTP Transfer Drawer (#24)

**Files:**
- Modify: `src/components/FileManager/DualPaneExplorer.tsx`
- Modify: `src/components/FileManager/FilePane.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ResizableSplitter`, `TransferDrawer`.
- Produces:
  - Top Directory Tree + Bottom File List per pane.
  - Horizontal splitter between Local and Remote.
  - Independent vertical splitters (Local Tree vs List, Remote Tree vs List).
  - TransferDrawer docked inside SFTP container width.

- [ ] **Step 1: Integrate `DirectoryTree` into Local and Remote panes**

In `DualPaneExplorer.tsx`, structure each pane as:
```tsx
<div className="flex flex-col h-full">
  {/* Top: Directory Tree */}
  <div style={{ height: `${treeHeightPercent}%` }} className="min-h-[100px] overflow-auto">
    <DirectoryTree isRemote={isRemote} onSelect={handleTreeSelect} />
  </div>
  {/* Vertical Splitter */}
  <ResizableSplitter vertical onResize={handleVerticalResize} />
  {/* Bottom: File List */}
  <div style={{ height: `${100 - treeHeightPercent}%` }} className="min-h-[120px] overflow-hidden flex-1">
    <FilePane ... />
  </div>
</div>
```

- [ ] **Step 2: Move `TransferDrawer` inside `DualPaneExplorer`**

Remove window-wide `TransferDrawer` from `App.tsx` and place it at the bottom of `DualPaneExplorer.tsx`. In split view, the transfer queue now stays within the SFTP side, leaving the terminal unblocked.

- [ ] **Step 3: Test multi-axis resizing**

Resize local/remote width -> top and bottom widths remain equal.  
Resize local tree height -> remote tree height remains independent.  
Open transfers -> transfer status stays confined to SFTP section.

- [ ] **Step 4: Commit**

```bash
git add src/components/FileManager/DualPaneExplorer.tsx src/App.tsx
git commit -m "feat(sftp): implement FileZilla layout with independent splitters and docked transfers (#24)"
```

---

## Phase 4: Color Themes (#27)

### Task 9: Theme Store & Presets (#27)

**Files:**
- Create: `src/stores/themeStore.ts`
- Modify: `src/components/Terminal/useTerminalSession.ts`
- Modify: `src/components/Layout/StatusBar.tsx` (or settings menu)

**Interfaces:**
- Consumes: xterm theme configuration.
- Produces: Presets (`Midnight`, `Dracula`, `One Dark`, `Nord`, `Solarized Dark`) with instant switching and persistence in `localStorage`.

- [ ] **Step 1: Create `src/stores/themeStore.ts`**

Define palette presets:
```ts
export interface ThemePalette {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  ansi: {
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
  };
}
```

- [ ] **Step 2: Connect active theme to `useTerminalSession.ts`**

Apply theme colors to `new Terminal({ theme: activeTheme })` and re-apply dynamically when theme changes.

- [ ] **Step 3: Test theme switching**

Switch theme -> Terminal palette updates immediately.

- [ ] **Step 4: Commit**

```bash
git add src/stores/themeStore.ts src/components/Terminal/useTerminalSession.ts
git commit -m "feat(theme): add color theme presets and terminal palette integration (#27)"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-issues-21-to-28-roadmap.md`.
