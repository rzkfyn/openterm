# OpenTerm Domain Glossary

### Active Session
An ongoing SSH connection instance identified by a unique `sessionId`, having terminal output, PTY dimensions, and an associated SFTP channel.

### View Mode
The primary screen layout presenting user interaction panes:
- **Terminal**: Fullscreen interactive terminal emulator.
- **SFTP**: Dual-pane file manager (Local filesystem and Remote SFTP).
- **Split**: Side-by-side view with terminal on one side and dual-pane SFTP on the other.

### Remote Working Directory
The active directory path navigated within the remote SFTP pane for a specific SSH session.

### Remote Path Cache
A per-session record preserving the Remote Working Directory during navigation, retaining the path across View Mode transitions.

### Double-Click File Action
The configured action executed when double-clicking a file item in the file explorer:
- **Transfer**: Copies or moves the selected file to the currently opened directory of the opposing pane (Local to Remote or Remote to Local).
- **Edit**: Opens the file inside the built-in file editor modal.

*Note: Directory items always navigate into the folder when double-clicked, regardless of this setting.*

### Context Menu Viewport Boundary
The physical bounding rectangle of the application window minus reserved screen real-estate (such as the bottom status bar), within which context menus must calculate anchor points and flip orientation to avoid overflow or clipping.

### Column Configuration
User-customized display widths and visibility toggles for metadata columns (`Size`, `Modified`) in file panes, persisted across application restarts.

### Middle Truncation
A string elision formatting technique for filenames that preserves the opening characters and trailing file extensions (e.g. `.tar.gz`, `.yaml`) while eliding middle characters with `...` to improve identification in narrow columns.

### Split Snap
An interaction triggered by double-clicking a resizable separator that instantly resets the split proportion between adjacent panes to 50/50.

### In-App Code Editor
An embedded virtualized text editor powered by CodeMirror 6 with format-aware syntax coloring, bracket matching, line numbering, and dirty-state tracking.

### External File Editor
An external operating system application (such as VS Code, Sublime Text, or Notepad++) launched to view and edit files outside OpenTerm.

### Remote Temp Cache
A secure temporary storage directory on the local machine used when opening remote SFTP files in an external editor.

### File Clipboard Copy
The operation of copying file paths and platform-compatible drop URIs to the operating system clipboard for rapid pasting into terminals or file managers.
