# Bi-directional Terminal <-> SFTP Directory Sync Split & OSC 7 Setup Guide Specification

**Date:** 2026-09-18  
**Status:** Approved  
**Author:** PI-Desktop & Ekatama Ilham Prayoga  

---

## 1. Objectives & Background

### 1.1 Problem Statement
OpenTerm currently provides a single setting `sftpAutoSync` (`openterm_sftp_auto_sync`) described as *"Terminal-SFTP Auto-Sync: Follow terminal current working directory via OSC 7"*. 

In practice:
1. **SFTP -> Terminal** sync works out of the box because OpenTerm directly dispatches `cd -- '<path>'\r` into the SSH PTY input stream.
2. **Terminal -> SFTP** sync fails on standard Linux/macOS remote servers unless the user's remote shell is explicitly configured to emit **OSC 7** (`\033]7;file://... \033\\`) escape sequences upon directory changes (`chpwd` / `PROMPT_COMMAND`).
3. Combining both distinct mechanisms under a single toggle causes user confusion: users expect bi-directional sync out of the box, perceive Terminal -> SFTP as a broken bug, and cannot disable one direction without breaking the other.

### 1.2 Goals
1. **Decouple Sync Controls**: Split `sftpAutoSync` into two independent configuration toggles:
   - `sftpSyncToTerminal`: SFTP to Terminal Auto-CD (default: `true`).
   - `sftpSyncFromTerminal`: Terminal to SFTP Auto-Follow via OSC 7 (default: `false`).
2. **Backward-Compatible Migration**: Migrate legacy `openterm_sftp_auto_sync` keys cleanly without resetting user preferences.
3. **In-App Remote Shell Setup Guide**: Add an inline/modal helper `(?)` in Settings providing 1-click copyable shell snippets for **Bash**, **Zsh**, and **Fish** to enable OSC 7 on remote hosts.
4. **Zero Security & Stream Risk**:
   - Strictly avoid active/blind PTY command injection (`pwd\r`) to avoid corrupting full-screen interactive programs (`vim`, `nano`, `htop`, `tmux`, password prompts).
   - Retain POSIX parameter-safe command formatting (`formatSafeCdCommand`).
   - Retain loop guard (`SyncCoordinator`) to prevent feedback bounce.

---

## 2. Architecture & Data Flow

```
                                  +-----------------------+
                                  |     SettingsModal     |
                                  +-----------+-----------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
         [sftpSyncToTerminal: true]                       [sftpSyncFromTerminal: false]
                     |                                                 |
                     v                                                 v
        +-------------------------+                       +-------------------------+
        |    DualPaneExplorer     |                       |   useTerminalSession    |
        +------------+------------+                       +------------+------------+
                     |                                                 |
         Remote Path Changed                               OSC 7 Escape Received
                     |                                                 |
                     v                                                 v
          syncCoordinator.shouldSync?                       syncCoordinator.shouldSync?
                     |                                                 |
                     +-- YES --> tauriApi.sshWrite                     +-- YES --> loadRemoteDir
                                 ("cd -- '<path>'\r")                              (sessionId, path)
```

---

## 3. Detailed Component Specifications

### 3.1 Settings Store (`src/stores/settingsStore.ts`)

#### State Interface Changes
```ts
export interface AppSettings {
  // ... other settings ...
  sftpSyncToTerminal: boolean;    // SFTP -> Terminal Auto-CD (default: true)
  sftpSyncFromTerminal: boolean;  // Terminal -> SFTP OSC 7 Auto-Follow (default: false)
}
```

#### Defaults
```ts
const defaultSettings: AppSettings = {
  // ...
  sftpSyncToTerminal: true,
  sftpSyncFromTerminal: false,
};
```

#### Migration Logic (`initializeSettings`)
```ts
// Backward-compatibility migration for legacy single key
const legacyAutoSync = localStorage.getItem('openterm_sftp_auto_sync');
const storedToTerminal = localStorage.getItem('openterm_sftp_sync_to_terminal');
const storedFromTerminal = localStorage.getItem('openterm_sftp_sync_from_terminal');

let sftpSyncToTerminal = true;
if (storedToTerminal !== null) {
  sftpSyncToTerminal = storedToTerminal === 'true';
} else if (legacyAutoSync !== null) {
  sftpSyncToTerminal = legacyAutoSync === 'true';
  localStorage.setItem('openterm_sftp_sync_to_terminal', String(sftpSyncToTerminal));
}

let sftpSyncFromTerminal = false;
if (storedFromTerminal !== null) {
  sftpSyncFromTerminal = storedFromTerminal === 'true';
} else {
  // Keep false by default for new / unconfigured users to avoid false expectations
  localStorage.setItem('openterm_sftp_sync_from_terminal', 'false');
}
```

---

### 3.2 SFTP Navigation Dispatcher (`src/components/FileManager/DualPaneExplorer.tsx`)

#### Logic Update
```ts
const { sftpSyncToTerminal } = useSettingsStore();

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

#### Toolbar AutoSync Toggle Button
Update button tooltip and toggle handler to toggle `sftpSyncToTerminal`:
- Active tooltip: `"SFTP to Terminal Auto-CD Active (Navigating folders runs cd in terminal)"`
- Paused tooltip: `"SFTP to Terminal Auto-CD Paused (Click to enable)"`

---

### 3.3 Terminal OSC 7 Listener (`src/components/Terminal/useTerminalSession.ts`)

#### Logic Update
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

---

### 3.4 Settings Modal UI & Remote Shell Guide (`src/components/Modal/SettingsModal.tsx`)

#### SFTP Tab Layout
Render two distinct toggle cards in the SFTP tab:

1. **Row 1: SFTP -> Terminal Auto-CD**
   - Title: `Sync SFTP to Terminal`
   - Description: `Automatically send cd command to active terminal when navigating SFTP folders`
   - Switch bound to: `sftpSyncToTerminal`

2. **Row 2: Terminal -> SFTP Auto-Follow**
   - Title: `Sync Terminal to SFTP`
   - Description: `Automatically update SFTP folder when terminal changes directory (Requires remote shell OSC 7)`
   - Switch bound to: `sftpSyncFromTerminal`
   - Action: `(?)` button that opens the **Remote Shell Setup Guide** modal / drawer.

#### Remote Shell Setup Guide Component (`src/components/Modal/Osc7SetupModal.tsx`)
A clear, accessible dialog explaining how to enable OSC 7 reporting:
- Title: `Remote Shell OSC 7 Configuration`
- Context: *"SSH does not report working directory changes to terminal emulators by default. OpenTerm listens for standard OSC 7 escape sequences. Add one snippet to your remote shell profile:"*
- Code tabs for:
  1. **Bash** (`~/.bashrc`):
     ```bash
     osc7_cwd() {
       printf "\033]7;file://%s%s\033\\" "$HOSTNAME" "$PWD"
     }
     PROMPT_COMMAND="osc7_cwd; $PROMPT_COMMAND"
     ```
  2. **Zsh** (`~/.zshrc`):
     ```zsh
     chpwd_osc7() {
       print -n "\e]7;file://${HOST}${PWD}\a"
     }
     autoload -Uz add-zsh-hook
     add-zsh-hook chpwd chpwd_osc7
     ```
  3. **Fish** (`~/.config/fish/config.fish`):
     ```fish
     function emit_osc7 --on-variable PWD
       printf '\e]7;file://%s%s\e\\' (hostname) $PWD
     end
     ```
- Features: 1-click **Copy Snippet** button with checkmark feedback, syntax highlighting / formatted mono block, and clear reload instruction (`source ~/.bashrc`).

---

## 4. Security & Quality Attributes

1. **Parameter & Injection Safety (OWASP / SEC-OWASP-01)**:
   - `formatSafeCdCommand` wraps directory path in single quotes with escaped internal quotes and `--` parameter delimiter. No raw command concatenation.
2. **No Blind Stream Injections**:
   - Zero background polling (`pwd`). Terminal input channel is never touched without explicit user or UI action.
3. **Fail-Closed Default (NIST CSF 2.0 / SEC-NIST-03)**:
   - `sftpSyncFromTerminal` defaults to `false`. Prevents silent feature expectation failure on unconfigured servers.
4. **Data Isolation**:
   - Configuration stored solely in local client storage. No credentials or server tokens touched.

---

## 5. Testing Plan

1. **`src/stores/__tests__/settingsStore.test.ts`**:
   - Verify initial defaults (`sftpSyncToTerminal: true`, `sftpSyncFromTerminal: false`).
   - Verify updating both keys independently.
   - Verify backward-compatibility migration when legacy `openterm_sftp_auto_sync` is present in `localStorage`.
2. **`src/components/Modal/__tests__/settingsModal.test.ts`**:
   - Verify both sync toggles render in the SFTP tab.
   - Verify clicking the `(?)` guide button opens the setup guide.
3. **`src/components/Modal/__tests__/osc7SetupModal.test.ts`**:
   - Verify tab switching between Bash, Zsh, and Fish.
   - Verify copy button writes snippet to clipboard.
4. **Regression Run**:
   - Execute full test suite `npm test` to guarantee 100% pass across all 29 test suites (132+ tests).
