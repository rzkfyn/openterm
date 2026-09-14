# Terminal-SFTP Synchronization and Terminal Input Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve duplicate paste and right-click focus loss bugs, eliminate Shift+Arrow ANSI character artifacts with keyboard text selection, and provide bi-directional directory synchronization between the interactive terminal and the SFTP file manager.

**Architecture:** 
- Input pipeline refactoring in `useTerminalSession.ts` to cleanly decouple DOM paste from custom key handling, preventing dual writes to the SSH stream.
- Keyboard selection engine in `useTerminalSession.ts` intercepting `Shift+Arrow*` to prevent VT sequence leaks and drive `term.select()`.
- Focus restoration callbacks in `TerminalView.tsx` and `TerminalContextMenu.tsx`.
- Bi-directional sync coordinator with an OSC 7 parser in `useTerminalSession.ts`, a safe `cd` dispatcher on SFTP directory changes, and a robust `lastSyncedPath` guard to break feedback loops.

**Tech Stack:** React 19, TypeScript, xterm.js (`@xterm/xterm` v6), Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-terminal-sftp-sync-and-input-fixes-design.md`

## Global Constraints
- Do not introduce external dependencies; use existing xterm APIs, Web Clipboard APIs, and Zustand store states.
- Shell commands dispatched to terminal must be sanitized using `cd -- "<path>"\r` to prevent argument injection.
- Feedback loop protection is mandatory: neither OSC 7 nor SFTP navigation must trigger recursive ping-pong updates.
- Keep the terminal focused when closing the context menu.

---

### Task 1: Fix Duplicate Paste and Right-Click Focus Loss

**Files:**
- Modify: `src/components/Terminal/useTerminalSession.ts`
- Modify: `src/components/Terminal/TerminalContextMenu.tsx`
- Modify: `src/components/Terminal/TerminalView.tsx`
- Create: `src/components/Terminal/__tests__/pasteAndFocus.test.ts`

**Interfaces:**
- Consumes: `tauriApi.sshWrite`, xterm `Terminal.paste`, `Terminal.focus`
- Produces: Single-fire paste dispatch and reliable focus return after context menu actions

- [ ] **Step 1: Write failing unit tests for paste deduplication and focus retention**

Create `src/components/Terminal/__tests__/pasteAndFocus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

describe('Paste handling logic', () => {
  it('should ignore duplicate paste events within debounced window', () => {
    let lastPaste = { text: '', time: 0 };
    const shouldSendPaste = (text: string, now: number) => {
      if (lastPaste.text === text && now - lastPaste.time < 100) {
        return false;
      }
      lastPaste = { text, time: now };
      return true;
    };

    expect(shouldSendPaste('12345', 1000)).toBe(true);
    expect(shouldSendPaste('12345', 1020)).toBe(false);
    expect(shouldSendPaste('12345', 1200)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes/fails**

Run: `npx vitest run src/components/Terminal/__tests__/pasteAndFocus.test.ts`
Expected: PASS baseline helper test.

- [ ] **Step 3: Modify `useTerminalSession.ts` to prevent duplicate paste**

In `src/components/Terminal/useTerminalSession.ts`:
- In `term.attachCustomKeyEventHandler`:
  - When `isCtrlOrCmd && (event.key === 'v' || event.key === 'V')`:
    - Call `event.preventDefault()` to stop browser native paste on textarea.
    - Read clipboard text and invoke `term.paste(clipText)`.
    - Do NOT call `tauriApi.sshWrite` directly here (xterm's `term.paste()` already dispatches through `term.onData`).
    - Return `false` to suppress xterm default key handling.
- In `pasteFromClipboard`:
  - Use `term.paste(text)` if `terminalRef.current` exists, falling back to `tauriApi.sshWrite(sessionId, text)`.

- [ ] **Step 4: Modify `TerminalContextMenu.tsx` and `TerminalView.tsx` to restore focus**

In `src/components/Terminal/TerminalContextMenu.tsx` and `src/components/Terminal/TerminalView.tsx`:
- Add `onFocusTerminal?: () => void` or call `terminal?.focus()` when context menu closes (`onClose`) and after actions (`onCopy`, `onPaste`, `onSelectAll`, `onClear`, `onReset`).
- Ensure dismissing via Escape or click-outside triggers `terminal?.focus()`.

- [ ] **Step 5: Run tests and verify**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/Terminal/
git commit -m "fix(terminal): prevent duplicate paste and restore focus after context menu"
```

---

### Task 2: Shift + Arrow Keyboard Text Selection

**Files:**
- Create: `src/components/Terminal/terminalSelection.ts`
- Create: `src/components/Terminal/__tests__/terminalSelection.test.ts`
- Modify: `src/components/Terminal/useTerminalSession.ts`

**Interfaces:**
- Consumes: xterm `buffer.active.cursorX`, `cursorY`, `baseY`, `term.select(col, row, len)`, `term.clearSelection()`
- Produces: `handleShiftArrowSelection(term, event, state)` helper

- [ ] **Step 1: Write failing unit tests for selection calculation**

Create `src/components/Terminal/__tests__/terminalSelection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculateSelectionDelta } from '../terminalSelection';

describe('calculateSelectionDelta', () => {
  it('should calculate correct delta for ArrowLeft and ArrowRight', () => {
    expect(calculateSelectionDelta('ArrowRight', 5, 0, 80)).toEqual({ col: 6, row: 0 });
    expect(calculateSelectionDelta('ArrowLeft', 5, 0, 80)).toEqual({ col: 4, row: 0 });
  });

  it('should calculate correct delta for ArrowUp and ArrowDown', () => {
    expect(calculateSelectionDelta('ArrowUp', 5, 2, 80)).toEqual({ col: 5, row: 1 });
    expect(calculateSelectionDelta('ArrowDown', 5, 2, 80)).toEqual({ col: 5, row: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Terminal/__tests__/terminalSelection.test.ts`
Expected: FAIL with "calculateSelectionDelta not found".

- [ ] **Step 3: Implement `terminalSelection.ts`**

Create `src/components/Terminal/terminalSelection.ts`:
- Define selection state tracking anchor position `(anchorCol, anchorRow)` and current target `(curCol, curRow)`.
- Export `calculateSelectionDelta(key, curCol, curRow, maxCols)`.
- Export `applyShiftArrowSelection(term, key, stateRef)`.
- On arrow key without shift: clear selection and reset state.

- [ ] **Step 4: Integrate into `useTerminalSession.ts`**

In `term.attachCustomKeyEventHandler`:
- If `event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown')`:
  - Call `event.preventDefault()`.
  - Invoke `applyShiftArrowSelection(term, event.key, selectionStateRef)`.
  - Return `false`.
- If arrow key pressed without Shift and selection active:
  - Clear selection via `term.clearSelection()`.
  - Reset `selectionStateRef`.
  - Return `true` (permit default shell navigation).

- [ ] **Step 5: Run tests and verify**

Run: `npx vitest run src/components/Terminal/__tests__/terminalSelection.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/Terminal/
git commit -m "feat(terminal): add shift+arrow keyboard selection and suppress ANSI leak"
```

---

### Task 3: Bi-directional Terminal <-> SFTP Synchronization

**Files:**
- Create: `src/utils/syncUtils.ts`
- Create: `src/utils/__tests__/syncUtils.test.ts`
- Modify: `src/components/Terminal/useTerminalSession.ts`
- Modify: `src/components/FileManager/DualPaneExplorer.tsx`
- Modify: `src/components/FileManager/PathBreadcrumb.tsx`
- Modify: `src/stores/fileManagerStore.ts`

**Interfaces:**
- Consumes: `useFileManagerStore.getState().loadRemoteDir`, `tauriApi.sshWrite`
- Produces: OSC 7 listener and remote path change trigger with loop prevention

- [ ] **Step 1: Write failing unit tests for sync path parsing and shell command escaping**

Create `src/utils/__tests__/syncUtils.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseOsc7Path, formatSafeCdCommand, shouldSyncPath } from '../syncUtils';

describe('syncUtils', () => {
  it('should parse OSC 7 path formats', () => {
    expect(parseOsc7Path('file://myhost/var/log')).toBe('/var/log');
    expect(parseOsc7Path('file://localhost/home/user/my%20folder')).toBe('/home/user/my folder');
    expect(parseOsc7Path('/etc/nginx')).toBe('/etc/nginx');
  });

  it('should format safe cd command without argument injection', () => {
    expect(formatSafeCdCommand('/var/log')).toBe('cd -- "/var/log"\r');
    expect(formatSafeCdCommand('/var/"quoted"/dir')).toBe('cd -- "/var/\\"quoted\\"/dir"\r');
  });

  it('should prevent sync bounce when target path matches last synced path', () => {
    const lastSynced = { path: '/var/log', time: 1000 };
    expect(shouldSyncPath('/var/log', lastSynced, 1050)).toBe(false);
    expect(shouldSyncPath('/tmp', lastSynced, 1050)).toBe(true);
    expect(shouldSyncPath('/var/log', lastSynced, 4000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/syncUtils.test.ts`
Expected: FAIL with missing functions.

- [ ] **Step 3: Implement `src/utils/syncUtils.ts`**

Implement:
- `parseOsc7Path(raw: string): string | null`
- `formatSafeCdCommand(remotePath: string): string`
- `shouldSyncPath(newPath: string, lastSync: { path: string; time: number }, now: number): boolean`

- [ ] **Step 4: Register OSC 7 parser in `useTerminalSession.ts`**

In `useTerminalSession.ts`:
- Register `term.parser.registerOscHandler(7, (data: string) => { ... })`:
  - Parse path with `parseOsc7Path(data)`.
  - If valid and `shouldSyncPath` passes:
    - Update `lastSyncedPath`.
    - Call `useFileManagerStore.getState().loadRemoteDir(sessionId, parsedPath)`.
  - Return `true`.

- [ ] **Step 5: Dispatch `cd` on SFTP navigation in `DualPaneExplorer.tsx` / `PathBreadcrumb.tsx`**

- Add auto-sync toggle button in remote path breadcrumb toolbar.
- When remote path changes (manual navigation, folder click, breadcrumb jump):
  - Check if auto-sync is enabled.
  - If target path differs from `lastSyncedPath`:
    - Update `lastSyncedPath`.
    - Send `formatSafeCdCommand(targetPath)` via `tauriApi.sshWrite(sessionId, cmd)`.

- [ ] **Step 6: Run full test suite to verify**

Run: `npm test`
Expected: All 70+ tests pass.

- [ ] **Step 7: Commit changes**

```bash
git add src/utils/ src/components/Terminal/ src/components/FileManager/ src/stores/
git commit -m "feat(sync): implement bi-directional terminal-sftp synchronization"
```
