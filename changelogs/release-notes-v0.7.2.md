# OpenTerm v0.7.2 Release Notes

OpenTerm v0.7.2 introduces an in-app Changelog Modal with live version tracking and version distance calculation, a safe zero-dependency Markdown renderer for release notes, decoupled SFTP / terminal path sync controls, and an interactive remote shell OSC 7 configuration guide.

---

## What's New

### 1. In-App Changelog Modal & Version Tracker (#39)
- **In-App Release Browser**: Browse past and current release notes directly inside OpenTerm without getting redirected to an external browser.
- **Live Version Distance Tracking**: Header indicator shows whether your client is up to date (`v0.7.2 · Up to date ✓`) or how many releases behind (`v0.7.0 · 2 versions behind latest v0.7.2`).
- **Release List Sidebar**: Dual-pane layout with status badges:
  - `[Latest]` indicator on the newest release.
  - `[Current]` badge identifying your active installed version.
  - `[New]` indicator on releases newer than your installed version.
- **Direct Actions**: 1-click "Download Update" and "View on GitHub" actions with safe external URL routing.
- **Dismissible**: Seamlessly dismiss via Escape key, close button, or backdrop click.

### 2. Zero-Dependency Safe Markdown Renderer
- **Pure React AST Parser**: Fast, lightweight block and inline Markdown parsing built specifically for release notes.
- **Strict Injection Safety**: 100% free of `dangerouslySetInnerHTML`. Elements are constructed directly as React AST nodes to prevent XSS.
- **Rich Formatting**: Supports headings (`h1`-`h6`), fenced code blocks with 1-click copy, unordered and ordered lists, blockquotes, horizontal dividers, bold, italic, and safe links (`http:`, `https:`).

### 3. Integrated Changelog Triggers
- **Status Bar**: Click or right-click the version indicator (`v0.7.2`) in the status bar to open the changelog. Clicking the update notification pill opens the changelog directly focused on the newest release.
- **Settings Modal**: "View Changelog" button added in the Settings > About tab.

### 4. SFTP / Terminal Path Sync Split (#38)
- **Independent Sync Toggles**: Split bi-directional path synchronization into independent controls:
  - Terminal -> SFTP sync (updates SFTP explorer when terminal changes directories).
  - SFTP -> Terminal sync (issues `cd` in terminal when navigating folders in SFTP).
- **Interactive OSC 7 Setup Guide Modal**: Added 1-click copyable shell configuration snippets for Bash, Zsh, and Fish to enable automatic OSC 7 directory reporting on remote servers.

---

## Verification & Stability
- 235/235 Vitest unit and component tests passing across 35 test suites.
- Clean Vite production bundle and TypeScript compilation (`tsc --noEmit && vite build`).
