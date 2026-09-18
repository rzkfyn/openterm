# In-App Changelog & Version Tracker Modal Specification

**Date:** 2026-09-18  
**Status:** Approved  
**Author:** PI-Desktop & Ekatama Ilham Prayoga  

---

## 1. Objectives & User Story

### 1.1 Problem Statement
When OpenTerm detects a new version, clicking the update banner currently launches the system browser directly to GitHub Releases. Users cannot preview changelogs, features, bug fixes, or breaking changes inside the application before deciding whether to download the update. Additionally, users have no in-app indicator showing how many versions behind they are.

### 1.2 User Story
As an OpenTerm user, when an update is available or when I check for updates:
1. I want to browse release notes and changelogs directly inside OpenTerm.
2. I want to see which version I am currently running (`[Current]` badge).
3. I want to see how far behind I am (e.g. *"Running v0.7.0 · 2 versions behind latest v0.7.2"*).
4. I want the option to click "Download Update" or dismiss and stay on my current version.

---

## 2. Architecture & Data Flow

```
                      GitHub Releases API
       (https://api.github.com/repos/rzkfyn/openterm/releases)
                               |
                               v
                       [updateChecker.ts]
                               |
                               v
                        [updateStore.ts]
               - releases: ReleaseItem[]
               - isChangelogOpen: boolean
               - selectedReleaseTag: string
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
    [StatusBar.tsx]                       [SettingsModal.tsx]
 (Click "Update vX.Y"                  (Click "View Changelog"
  or "vX.Y" version)                    in About tab)
            |                                     |
            +------------------+------------------+
                               |
                               v
                     [ChangelogModal.tsx]
       +-----------------------------------------------+
       | Header: Current version & Behind count status |
       +-----------------------+-----------------------+
       | Left: Releases List   | Right: Markdown Notes |
       | - [Latest] v0.7.2     | - Release Title       |
       | - [New]    v0.7.1     | - Formatted Markdown  |
       | - [Current]v0.7.0     | - [Download] [GitHub] |
       | -          v0.6.9     |                       |
       +-----------------------+-----------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Data Types & Service (`src/services/updateChecker.ts`)

#### 1. Interfaces
```ts
export interface ReleaseItem {
  id: number;
  tagName: string;        // e.g. "v0.7.2"
  name: string;           // e.g. "v0.7.2 - Terminal Sync & UI"
  publishedAt: string;    // ISO string
  body: string;           // Raw markdown text
  htmlUrl: string;        // Web release link
  isPrerelease: boolean;
}

export interface ChangelogStateInfo {
  currentVersion: string;
  latestVersion: string;
  releases: ReleaseItem[];
  behindCount: number;
  isLatest: boolean;
}
```

#### 2. Service API
- `fetchReleasesList(force?: boolean): Promise<ReleaseItem[]>`:
  - Fetches `https://api.github.com/repos/rzkfyn/openterm/releases?per_page=15`.
  - Caches to `localStorage['openterm_cached_releases']` with 30-minute TTL.
  - Returns sanitized, sorted `ReleaseItem[]`.
- `calculateVersionDistance(releases: ReleaseItem[], currentVersion: string)`:
  - Compares versions via `parseSemver`.
  - Determines index of installed version and counts newer releases above it.
  - Returns `behindCount` and `isLatest`.

---

### 3.2 State Store (`src/stores/updateStore.ts`)

#### Extended Store State:
```ts
interface UpdateState {
  // Existing fields...
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  hasUpdate: boolean;
  isChecking: boolean;
  dismissed: boolean;
  checkStatus: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

  // New Changelog fields:
  releases: ReleaseItem[];
  isLoadingReleases: boolean;
  isChangelogOpen: boolean;
  selectedReleaseTag: string | null;

  // Actions:
  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: () => void;
  openChangelog: (initialTag?: string) => void;
  closeChangelog: () => void;
  selectRelease: (tagName: string) => void;
  fetchReleases: (force?: boolean) => Promise<void>;
}
```

---

### 3.3 Safe Zero-Dependency Markdown Renderer (`src/components/Common/MarkdownRenderer.tsx`)

Pure React parser rendering release notes cleanly without external libraries or raw HTML injection:
- Supports:
  - Headings (`#`, `##`, `###`) styled with appropriate typography and colors.
  - Unordered lists (`- `, `* `) with bullet spacing.
  - Numbered lists (`1. `).
  - Code spans (`` `code` ``) with subtle monospaced dark background.
  - Fenced code blocks (` ```bash `) with syntax card styling.
  - Bold text (`**text**`) and italic text (`*text*`).
  - Web links (`[text](url)`) opening safely via `tauriApi.openUrl`.
- XSS-safe: creates React elements directly; never uses `dangerouslySetInnerHTML`.

---

### 3.4 In-App Changelog Modal (`src/components/Modal/ChangelogModal.tsx`)

#### Layout:
1. **Modal Container**:
   - Fixed centered overlay, max width `900px`, height `80vh`.
   - Dark theme styling `#11111a` matching app design tokens.
   - Dismissible via `X` button, backdrop click, and `Escape` key.

2. **Top Header**:
   - Left: `Sparkles` / `History` icon, title `"Changelog"`, subtitle `"Browse what's new in each release"`.
   - Center / Badge:
     - If up to date: Emerald badge `v0.7.2 · Up to date ✓`
     - If behind: Amber badge `v0.7.0 · 2 versions behind latest v0.7.2`
   - Right:
     - `"Check for Updates"` refresh button with spinner.
     - Close button.

3. **Split Body**:
   - **Left Sidebar (260px)**:
     - Scrollable list of releases.
     - Each item displays:
       - Tag name (e.g. `v0.7.2`)
       - Published date relative/formatted (e.g. `Sep 18, 2026`)
       - Status Badges:
         - `[Latest]` (Indigo pill) on newest release.
         - `[Current]` (Emerald pill) on installed `APP_VERSION`.
         - Amber dot on uninstalled releases newer than current.
     - Selected item highlighted with active background border.
   - **Right Content View (Flex-1)**:
     - Header card:
       - Release Name + Date.
       - Buttons:
         - Primary `Download Update` (indigo background, downloads or opens release page).
         - Secondary `View on GitHub` (opens external browser).
     - Scrollable body:
       - Markdown rendered release notes.

---

### 3.5 Integration Touchpoints

1. **`src/components/Layout/StatusBar.tsx`**:
   - Clicking `Update v0.7.2` pill calls `openChangelog('v0.7.2')`.
   - Clicking `v0.7.1` version badge calls `openChangelog()`.
2. **`src/components/Modal/SettingsModal.tsx`**:
   - In About tab, clicking "Release Notes" calls `openChangelog()`.
3. **`src/App.tsx`**:
   - Render `<ChangelogModal />` alongside other application modals.

---

## 4. Security & Performance Constraints

1. **SEC-OWASP-01 / Injection Safety**: Zero `dangerouslySetInnerHTML`. Pure React AST construction for Markdown.
2. **SEC-NIST-02 / Outbound Isolation**: 5-second timeout on GitHub API requests; cache responses for 30 minutes in `localStorage` to avoid rate limiting.
3. **Fail-Closed Offline Grace**: If GitHub API fails (offline or rate-limited), fallback to showing cached releases or empty state without crashing.
4. **Zero Extra Dependencies**: Built using React 19, Lucide React, and Tailwind CSS already in `package.json`.
