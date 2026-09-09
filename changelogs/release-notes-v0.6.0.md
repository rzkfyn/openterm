# OpenTerm v0.6.0 Release Notes

OpenTerm v0.6.0 brings a major FileZilla-style dual directory tree layout, terminal copy/paste shortcuts & context menu, terminal viewport overflow fixes, raw path navigation with mouse history, live folder bookmarks, update checker accuracy improvements, and customizable color theme presets.

---

## What's New in v0.6.0

### 1. FileZilla-Style Dual Directory Tree Layout (#24)
- **Collapsible Directory Trees**: Integrated top directory tree views for both local and remote file systems with expandable directory nodes.
- **Independent Multi-Axis Resizing**:
  - Horizontal splitter synchronizes the width of top and bottom panes between local and remote.
  - Independent vertical splitters allow customizing directory tree height separately from the file list.
- **Docked SFTP Transfer Drawer**: Relocated the file transfer queue into the SFTP container so it remains confined to the file manager, keeping the terminal unobstructed in split layouts.

### 2. Terminal Copy/Paste Shortcuts & Context Menu (#22, #26)
- **Direct Clipboard Integration**:
  - `Ctrl+Shift+C` / `Ctrl+C` (when selection is active) copies directly to the OS clipboard.
  - `Ctrl+V` pastes OS clipboard content directly to the shell prompt.
- **Terminal Context Menu**: Right-click menu with *Copy*, *Paste*, *Select All*, *Clear Terminal*, and *Reset Terminal*.
- **Mouse Reporting Fix**: Suppressed middle-click (`button 1`) and auxiliary mouse reporting noise to avoid garbled ANSI escape sequences in the terminal.

### 3. Terminal Viewport Overflow & Prompt Line Fixes (#21)
- **Strict Boundary Geometry**: Wrapped terminal viewport in zero-padding `min-h-0 overflow-hidden` containers to prevent visual overflow underneath the status bar.
- **Stabilized PTY Resize**: Debounced initial geometry calculations with double `requestAnimationFrame` to ensure xterm fit addons report exact dimensions to the backend PTY.

### 4. Raw Path View & Mouse/Keyboard Navigation History (#25)
- **Direct Raw Path Bar**: Instant editable raw path bar with 1-click clipboard copy and breadcrumb mode toggle.
- **History Stacks & Navigation**: Full back/forward navigation history per pane supporting:
  - Mouse button 4 (Back) & Mouse button 5 (Forward)
  - `Alt + ArrowLeft` (Back) & `Alt + ArrowRight` (Forward) shortcuts.

### 5. Live SFTP Folder Bookmarks (#28)
- **Bookmark Current Locations**: Quickly bookmark active local and remote path pairs directly from the SFTP toolbar with profile persistence in `savedConnectionStore`.
- **Folder Context Menu Bookmarking**: Right-click any directory to quickly add it to bookmarks.

### 6. Color Theme Presets & Customization (#27)
- **5 Built-in Palettes**: *Midnight*, *Dracula*, *One Dark*, *Nord*, and *Solarized Dark*.
- **Live Terminal Sync**: Instant palette updates across all active terminal sessions without requiring reconnections.
- **Status Bar Theme Selector**: Quick-access theme picker in the bottom status bar with persistence in `localStorage`.

### 7. Update Notification Accuracy & Manual Check Feedback (#23)
- **Stale Cache Invalidation**: Fixed false-positive update notifications when running the latest version.
- **Visual Feedback**: Added immediate status indicators and tooltips when manually checking for updates.

---

## Verification & Stability
- 17/17 Vitest test suites passing (68/68 unit and component tests).
- 0 TypeScript typecheck errors (`tsc --noEmit`).
- Clean Vite production build.
