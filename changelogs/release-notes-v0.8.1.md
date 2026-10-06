# ShellFerry v0.8.1 Release Notes

ShellFerry v0.8.1 fixes drag-and-drop file transfer from Finder/Desktop into the SFTP file manager on macOS, adds native drop-zone highlighting for OS drags, and replaces the oversized drag icon with a VSCode-style filename pill preview.

---

## What's New

### 1. Fix macOS Drag-and-Drop from Finder/Desktop (#20)
- **Tauri 2 Lifecycle API**: Replaced unreliable raw `listen('tauri://drag-drop')` with the official `getCurrentWebview().onDragDropEvent()` API, which registers all four drag lifecycle events (`enter`/`over`/`drop`/`leave`) and correctly handles macOS WKWebView interception from `draggable` DOM elements.
- **Removed Electron-Only Code**: Stripped dead `(file as any).path` fallback from HTML5 drop handlers in FileItemRow and FilePane. File paths in Tauri come exclusively from native drag-drop events, not from the browser's `DataTransfer` API.
- **Fixed Duplicate Transfers**: Resolved a listener stacking bug where the async `useEffect` cleanup failed to unregister previous listeners before registering new ones on re-renders, causing a single file drop to trigger multiple uploads.

### 2. Native Drop-Zone Highlighting
- **Visual Feedback for OS Drags**: Dragging files from Finder or Desktop over a pane now shows the same drop-zone overlay (dashed indigo border, backdrop blur, "Drop to Upload/Download" label) previously only visible during internal pane-to-pane drags.
- **Live Pane Tracking**: The highlighted pane updates in real-time as the cursor moves between Local and Remote panes during a drag operation.

### 3. VSCode-Style Drag Preview
- **Filename Pill Label**: Dragging files out of ShellFerry now shows a compact dark pill with the filename(s) instead of the previous oversized 512×512 app icon.
- **Multi-File Support**: When dragging multiple files, the pill displays up to 3 filenames with a "+N more" overflow indicator.
- **Dynamic Rendering**: The pill is rendered at runtime via Canvas API at the display's native DPR, matching the system font and ShellFerry's dark theme.
