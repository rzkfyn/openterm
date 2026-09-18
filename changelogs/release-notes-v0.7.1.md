# OpenTerm v0.7.1 Release Notes

OpenTerm v0.7.1 fixes a critical modal overflow issue on smaller screens and introduces a responsive two-column layout for the Connection Profile editor.

---

## What's New & Fixes

### 1. Connection Profile Modal Viewport Overflow Fix (#37)
- **Viewport Clamping**: Constrained modal container to `max-h-[85vh]` with flex column layout.
- **Pinned Top & Bottom Chrome**: Header and action buttons (`Cancel`, `Save`, `Save & Connect`) are pinned with `shrink-0`, ensuring buttons remain visible and clickable across all window heights.
- **Internal Scrolling**: Form fields scroll smoothly inside a dedicated `overflow-y-auto min-h-0` container when content exceeds available space.

### 2. Responsive 2-Column Profile Layout
- **Desktop 2-Column Split**: Widened modal dialog to `max-w-3xl` with a responsive `grid grid-cols-1 md:grid-cols-2` layout.
  - **Left Column**: General profile details, host target, port, username, authentication credentials (Password / Key / Passphrase), and vault persistence toggle.
  - **Right Column**: SFTP Directory Bookmarks and SSH Quick Commands in dedicated, collapsible card modules with count badges.
- **Responsive Stacking**: Automatically reflows to a single stacked column on narrow screens (<768px) or snapped window splits without horizontal clipping.

### 3. Dialog UX & Accessibility Enhancements
- Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` attributes.
- Added `Escape` key shortcut listener to close the modal dialog.
- Added `select-text` utility class to ensure text selection and copying work cleanly within modal input fields.

---

## Verification & Stability
- 132/132 Vitest unit and component tests passing (29 test suites).
- Clean Vite production bundle and TypeScript compilation (`tsc --noEmit && vite build`).
