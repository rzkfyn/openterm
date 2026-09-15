# OpenTerm v0.7.0 Release Notes

OpenTerm v0.7.0 brings full-app theme synchronization, an application Settings modal with customizable typography and font zoom shortcuts, in-buffer terminal text search with live match highlighting, native macOS Touch ID biometrics support via LocalAuthentication, and connection lifecycle fixes.

---

## What's New in v0.7.0

### 1. Application Settings & Typography Customization (#35)
- **Settings Modal (`Cmd+,` / `Ctrl+,`)**: Dedicated preferences dialog accessible via header gear icon, dashboard button, and global keyboard shortcut.
- **Independent Monospace Font Stacks**: Choose from *JetBrains Mono*, *Fira Code*, *Cascadia Code*, *SF Mono*, *Menlo*, *Monaco*, *Consolas*, *Source Code Pro*, *System Monospace*, or specify custom font families.
- **Terminal Sizing & Line Height**: Real-time font size slider (10px–24px) and configurable line height.
- **Application Interface Font**: Separately configure app UI font (*System Default*, *Geist Sans*, *Inter*, *Segoe UI*, *Roboto*, *Ubuntu*, or custom).
- **Live Terminal Font Zoom Shortcuts**: `Cmd/Ctrl + "+"` (zoom in), `Cmd/Ctrl + "-"` (zoom out), and `Cmd/Ctrl + "0"` (reset zoom) inside active terminal sessions.
- **Terminal Preferences**: Configurable cursor style (*Block*, *Underline*, *Bar*), cursor blink, scrollback buffer (up to 20,000 lines), and copy-on-select.

### 2. Terminal In-Buffer Text Search (#35, #36)
- **Find in Terminal (`Cmd+F` / `Ctrl+F`)**: Floating search overlay with live match highlighting and match index counter (`1/14`).
- **Match Options**: Next/previous navigation (`Enter` / `Shift+Enter`), match case (`Aa`), whole word (`\b`), and regular expressions (`.*`).
- **Robust Error Handling**: Added `allowProposedApi: true` for decoration APIs, real-time regex syntax validation with visual error indicators, and wrapped `TerminalView` in React `ErrorBoundary`.
- **Search Re-triggering**: Support pressing `Cmd+F` with newly highlighted terminal text to immediately search the new query.

### 3. Full-App Theme Synchronization (#35)
- **Chrome-Wide Theme Adaptation**: Theme presets (*Midnight*, *Dracula*, *One Dark*, *Nord*, *Solarized Dark*) now apply across all UI elements, including App Header, Status Bar, Dashboard, File Explorer, Directory Tree, and all Modals.
- **Dynamic CSS Variables**: Seamless theme switching via `[data-theme]` attributes without page reloads.

### 4. Native macOS Touch ID Support (#35)
- **LocalAuthentication Integration**: Hardware-level Touch ID biometric prompt using `objc2-local-authentication` and `block2`.
- **Dynamic Platform Adaptation**: Contextually displays "Touch ID" on macOS vs "Windows Hello" on Windows across security prompts.

### 5. Connection Lifecycle Fix (#35)
- **Safe Save & Connect**: Inverted connection execution order to prevent saving broken or unreachable connection profiles when SSH authentication fails.

---

### Verification
- `npm run build`: Success (0 TypeScript errors)
- `npm test`: **28 test files passed, 127 tests passed (100%)**
- `cargo test`: **32 tests passed (100%)**
