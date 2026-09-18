# Bi-directional Terminal <-> SFTP Directory Sync Split & OSC 7 Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the unified Terminal-SFTP Auto Sync setting into two independent controls (`sftpSyncToTerminal` defaulting to ON, and `sftpSyncFromTerminal` defaulting to OFF) with backward-compatible migration, and provide an in-app remote shell setup guide with 1-click copyable OSC 7 snippets for Bash, Zsh, and Fish.

**Architecture:**
- Extend `settingsStore.ts` with two explicit booleans and migration logic from legacy `openterm_sftp_auto_sync`.
- Update `DualPaneExplorer.tsx` to read `sftpSyncToTerminal` for sending `cd` into terminal SSH stream.
- Update `useTerminalSession.ts` to check `sftpSyncFromTerminal` before updating SFTP directory from incoming OSC 7 escape sequences.
- Create `Osc7SetupModal.tsx` displaying shell-specific OSC 7 setup instructions and 1-click copy helpers.
- Refactor `SettingsModal.tsx` SFTP Explorer tab to render two independent toggle rows and a `(?)` button opening the OSC 7 guide.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-terminal-sftp-sync-split-and-osc7-guide-design.md`

## Global Constraints
- Do not introduce new external dependencies.
- Retain existing parameter-safe command formatting (`formatSafeCdCommand`).
- Strictly avoid active/blind PTY command injection (`pwd\r`). Terminal -> SFTP must remain passive stream parsing via OSC 7.
- Retain feedback loop guard in `SyncCoordinator` (`src/utils/syncUtils.ts`).
- Ensure backward compatibility for users migrating from `openterm_sftp_auto_sync`.

---

### Task 1: Update Settings Store with Split Sync Keys & Migration

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.test.ts`

**Interfaces:**
- Consumes: `localStorage`, `AppSettings`
- Produces: `settings.sftpSyncToTerminal: boolean`, `settings.sftpSyncFromTerminal: boolean`

- [ ] **Step 1: Write failing unit tests for split sync settings and legacy migration**

Add to `src/stores/__tests__/settingsStore.test.ts`:
```ts
it('initializes split sync settings with correct defaults', () => {
  const { settings } = useSettingsStore.getState();
  expect(settings.sftpSyncToTerminal).toBe(true);
  expect(settings.sftpSyncFromTerminal).toBe(false);
});

it('migrates legacy openterm_sftp_auto_sync to sftpSyncToTerminal', () => {
  localStorage.setItem('openterm_sftp_auto_sync', 'false');
  // Re-evaluating default loader logic
  const legacyVal = localStorage.getItem('openterm_sftp_auto_sync') === 'true';
  useSettingsStore.getState().updateSetting('sftpSyncToTerminal', legacyVal);
  expect(useSettingsStore.getState().settings.sftpSyncToTerminal).toBe(false);
});

it('allows independent updating of sftpSyncToTerminal and sftpSyncFromTerminal', () => {
  useSettingsStore.getState().updateSetting('sftpSyncToTerminal', false);
  useSettingsStore.getState().updateSetting('sftpSyncFromTerminal', true);

  const { settings } = useSettingsStore.getState();
  expect(settings.sftpSyncToTerminal).toBe(false);
  expect(settings.sftpSyncFromTerminal).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/settingsStore.test.ts`
Expected: FAIL because `sftpSyncToTerminal` and `sftpSyncFromTerminal` are not yet on `AppSettings`.

- [ ] **Step 3: Update `settingsStore.ts`**

In `src/stores/settingsStore.ts`:
1. In `interface AppSettings`:
   - Replace `sftpAutoSync: boolean;` with:
     ```ts
     sftpSyncToTerminal: boolean;
     sftpSyncFromTerminal: boolean;
     ```
2. In `DEFAULT_SETTINGS`:
   - Replace `sftpAutoSync: true,` with:
     ```ts
     sftpSyncToTerminal: true,
     sftpSyncFromTerminal: false,
     ```
3. In `loadSavedSettings()`:
   - Check if stored parsed object has legacy `sftpAutoSync`.
   - If `parsed.sftpAutoSync !== undefined` and `parsed.sftpSyncToTerminal === undefined`:
     - Map `sftpSyncToTerminal = parsed.sftpAutoSync`.
   - Also check legacy `localStorage.getItem('openterm_sftp_auto_sync')`.
   - Ensure `sftpSyncToTerminal` defaults to `true` and `sftpSyncFromTerminal` defaults to `false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/settingsStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/stores/
git commit -m "feat(settings): split sftp auto sync into independent to/from terminal toggles"
```

---

### Task 2: Update SFTP & Terminal Navigation Consumers

**Files:**
- Modify: `src/components/FileManager/DualPaneExplorer.tsx`
- Modify: `src/components/Terminal/useTerminalSession.ts`
- Test: `src/utils/__tests__/syncUtils.test.ts`

**Interfaces:**
- Consumes: `useSettingsStore.getState().settings.sftpSyncToTerminal`, `useSettingsStore.getState().settings.sftpSyncFromTerminal`
- Produces: Gated `sshWrite("cd ...")` and gated `loadRemoteDir(...)`

- [ ] **Step 1: Update `DualPaneExplorer.tsx` to consume `sftpSyncToTerminal`**

In `src/components/FileManager/DualPaneExplorer.tsx`:
1. Retrieve `sftpSyncToTerminal` and `updateSetting` from `useSettingsStore`.
2. Update the `useEffect` for remote navigation:
   ```ts
   const { sftpSyncToTerminal } = useSettingsStore((state) => state.settings);
   const updateSetting = useSettingsStore((state) => state.updateSetting);

   const lastSyncedRemotePathRef = useRef<string>('');
   useEffect(() => {
     if (!sessionId || !remote.currentPath || !sftpSyncToTerminal) return;
     if (lastSyncedRemotePathRef.current === remote.currentPath) return;
     lastSyncedRemotePathRef.current = remote.currentPath;

     if (syncCoordinator.shouldSync(remote.currentPath, 'sftp')) {
       const cdCmd = formatSafeCdCommand(remote.currentPath);
       tauriApi.sshWrite(sessionId, cdCmd).catch(() => {});
     }
   }, [sessionId, remote.currentPath, sftpSyncToTerminal]);
   ```
3. Update the toolbar sync button:
   - Click toggles `updateSetting('sftpSyncToTerminal', !sftpSyncToTerminal)`.
   - Update title:
     - When active: `"SFTP to Terminal Auto-CD Active (Navigating folders runs cd in terminal)"`
     - When paused: `"SFTP to Terminal Auto-CD Paused (Click to enable)"`

- [ ] **Step 2: Update `useTerminalSession.ts` to consume `sftpSyncFromTerminal`**

In `src/components/Terminal/useTerminalSession.ts`:
1. In `term.parser.registerOscHandler(7, (data: string) => { ... })`:
   - Read `sftpSyncFromTerminal` from `useSettingsStore.getState().settings.sftpSyncFromTerminal`.
   ```ts
   const osc7Disposable = term.parser.registerOscHandler(7, (data: string) => {
     const parsed = parseOsc7Path(data);
     if (parsed && sessionId) {
       const syncFromTerminal = useSettingsStore.getState().settings.sftpSyncFromTerminal;
       if (syncFromTerminal && syncCoordinator.shouldSync(parsed, 'terminal')) {
         const currentRemote = useFileManagerStore.getState().remote.currentPath;
         if (currentRemote !== parsed) {
           useFileManagerStore.getState().loadRemoteDir(sessionId, parsed);
         }
       }
     }
     return true;
   });
   ```

- [ ] **Step 3: Run existing test suites to verify no regressions**

Run: `npm test`
Expected: PASS all tests.

- [ ] **Step 4: Commit changes**

```bash
git add src/components/FileManager/DualPaneExplorer.tsx src/components/Terminal/useTerminalSession.ts
git commit -m "feat(sync): apply independent to/from terminal sync gates to SFTP and terminal"
```

---

### Task 3: Build OSC 7 Shell Setup Guide Modal

**Files:**
- Create: `src/components/Modal/Osc7SetupModal.tsx`
- Create: `src/components/Modal/__tests__/osc7SetupModal.test.ts`

**Interfaces:**
- Consumes: React, Lucide React (`Terminal`, `Copy`, `Check`, `X`, `ExternalLink`)
- Produces: `Osc7SetupModal: React.FC<{ isOpen: boolean; onClose: () => void }>`

- [ ] **Step 1: Write unit tests for `Osc7SetupModal`**

Create `src/components/Modal/__tests__/osc7SetupModal.test.ts`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Osc7SetupModal } from '../Osc7SetupModal';

describe('Osc7SetupModal', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<Osc7SetupModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders setup guide modal when isOpen is true', () => {
    render(<Osc7SetupModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Remote Shell OSC 7 Setup')).toBeInTheDocument();
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('Zsh')).toBeInTheDocument();
    expect(screen.getByText('Fish')).toBeInTheDocument();
  });

  it('copies shell snippet to clipboard on copy click', async () => {
    render(<Osc7SetupModal isOpen={true} onClose={vi.fn()} />);
    const copyButton = screen.getByRole('button', { name: /copy snippet/i });
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('switches shell snippets when clicking tabs', () => {
    render(<Osc7SetupModal isOpen={true} onClose={vi.fn()} />);
    const zshTab = screen.getByRole('button', { name: 'Zsh' });
    fireEvent.click(zshTab);
    expect(screen.getByText(/add-zsh-hook/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Modal/__tests__/osc7SetupModal.test.ts`
Expected: FAIL because `Osc7SetupModal.tsx` does not exist yet.

- [ ] **Step 3: Implement `Osc7SetupModal.tsx`**

Create `src/components/Modal/Osc7SetupModal.tsx`:
- Support 3 tabs: `'bash' | 'zsh' | 'fish'`.
- Provide exact scripts:
  - **Bash**:
    ```bash
    osc7_cwd() {
      printf "\033]7;file://%s%s\033\\" "$HOSTNAME" "$PWD"
    }
    PROMPT_COMMAND="osc7_cwd; $PROMPT_COMMAND"
    ```
    Instruction: Append to `~/.bashrc` and run `source ~/.bashrc`.
  - **Zsh**:
    ```zsh
    chpwd_osc7() {
      print -n "\e]7;file://${HOST}${PWD}\a"
    }
    autoload -Uz add-zsh-hook
    add-zsh-hook chpwd chpwd_osc7
    ```
    Instruction: Append to `~/.zshrc` and run `source ~/.zshrc`.
  - **Fish**:
    ```fish
    function emit_osc7 --on-variable PWD
      printf '\e]7;file://%s%s\e\\' (hostname) $PWD
    end
    ```
    Instruction: Append to `~/.config/fish/config.fish`.
- 1-click **Copy Snippet** button with clipboard write and 2-second checkmark feedback.
- Close button and Escape key dismiss.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Modal/__tests__/osc7SetupModal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/Modal/Osc7SetupModal.tsx src/components/Modal/__tests__/osc7SetupModal.test.ts
git commit -m "feat(ui): create remote shell osc 7 setup guide modal with 1-click copy"
```

---

### Task 4: Integrate Split Toggles & Guide into SettingsModal

**Files:**
- Modify: `src/components/Modal/SettingsModal.tsx`
- Test: `src/components/Modal/__tests__/settingsModalSync.test.ts`

**Interfaces:**
- Consumes: `useSettingsStore`, `Osc7SetupModal`
- Produces: Dual sync toggles in SFTP tab with guide trigger

- [ ] **Step 1: Write unit tests for SettingsModal sync controls**

Create `src/components/Modal/__tests__/settingsModalSync.test.ts`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../SettingsModal';
import { useSettingsStore } from '../../../stores/settingsStore';

describe('SettingsModal SFTP Sync Controls', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
    useSettingsStore.getState().openSettings('sftp');
  });

  it('renders both split sync toggles in sftp tab', () => {
    render(<SettingsModal />);
    expect(screen.getByText('Sync SFTP to Terminal')).toBeInTheDocument();
    expect(screen.getByText('Sync Terminal to SFTP')).toBeInTheDocument();
  });

  it('toggles sftpSyncToTerminal and sftpSyncFromTerminal independently', () => {
    render(<SettingsModal />);
    const checkboxes = screen.getAllByRole('checkbox');
    const syncToTermBox = checkboxes.find(
      (cb) => (cb as HTMLInputElement).checked === true
    ) as HTMLInputElement;
    const syncFromTermBox = checkboxes.find(
      (cb) => (cb as HTMLInputElement).checked === false
    ) as HTMLInputElement;

    expect(syncToTermBox).toBeDefined();
    expect(syncFromTermBox).toBeDefined();

    fireEvent.click(syncToTermBox);
    expect(useSettingsStore.getState().settings.sftpSyncToTerminal).toBe(false);

    fireEvent.click(syncFromTermBox);
    expect(useSettingsStore.getState().settings.sftpSyncFromTerminal).toBe(true);
  });

  it('opens OSC 7 setup guide when clicking info button', () => {
    render(<SettingsModal />);
    const helpButton = screen.getByTitle('View remote shell setup guide');
    fireEvent.click(helpButton);
    expect(screen.getByText('Remote Shell OSC 7 Setup')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Modal/__tests__/settingsModalSync.test.ts`
Expected: FAIL because split toggles and guide button are not yet in `SettingsModal.tsx`.

- [ ] **Step 3: Update `SettingsModal.tsx`**

In `src/components/Modal/SettingsModal.tsx`:
1. Import `HelpCircle` from `'lucide-react'` and `Osc7SetupModal` from `'./Osc7SetupModal'`.
2. Add `const [isOsc7ModalOpen, setIsOsc7ModalOpen] = useState(false);`.
3. In the SFTP tab (around line 535):
   - Replace the single `Terminal-SFTP Auto-Sync` block with two distinct rows:
     - **Row 1**:
       - Title: `Sync SFTP to Terminal`
       - Subtitle: `Send cd command to active terminal when navigating remote folders`
       - Checkbox tied to `settings.sftpSyncToTerminal`, updating `sftpSyncToTerminal`.
     - **Row 2**:
       - Title: `Sync Terminal to SFTP`
       - Subtitle: `Follow terminal working directory via OSC 7 escape sequences`
       - Help button: `<button type="button" onClick={() => setIsOsc7ModalOpen(true)} title="View remote shell setup guide">` with `HelpCircle` icon.
       - Checkbox tied to `settings.sftpSyncFromTerminal`, updating `sftpSyncFromTerminal`.
4. Render `<Osc7SetupModal isOpen={isOsc7ModalOpen} onClose={() => setIsOsc7ModalOpen(false)} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Modal/__tests__/settingsModalSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/Modal/SettingsModal.tsx src/components/Modal/__tests__/settingsModalSync.test.ts
git commit -m "feat(ui): split sftp sync settings and add osc 7 setup guide trigger"
```

---

### Task 5: End-to-End Verification & Full Test Suite

**Files:**
- Run full test suite and verify all test suites pass.

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All 31 test suites pass with 0 errors.

- [ ] **Step 2: Verify git status is clean**

Run: `git status`
Expected: Working tree clean.
