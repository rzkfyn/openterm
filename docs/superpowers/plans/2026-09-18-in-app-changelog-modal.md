# In-App Changelog & Version Tracker Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an in-app Changelog Modal that fetches and displays GitHub Releases, visually tracks the user's currently installed version against the latest release, calculates version distance, renders formatted release notes cleanly with zero extra dependencies, and allows 1-click update downloading.

**Architecture:**
- Extend `src/services/updateChecker.ts` with `fetchReleasesList` and `calculateVersionDistance` using existing SemVer utilities.
- Extend `src/stores/updateStore.ts` with release collection state, changelog open/close controls, and release selection.
- Build safe zero-dependency `src/components/Common/MarkdownRenderer.tsx` using pure React AST parsing.
- Build `src/components/Modal/ChangelogModal.tsx` displaying 2-column release browser with version badges (`[Current]`, `[Latest]`, `[New]`), distance status pill, and download buttons.
- Connect trigger points in `StatusBar.tsx`, `SettingsModal.tsx`, and mount in `App.tsx`.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-in-app-changelog-modal-design.md`

## Global Constraints
- Do not introduce new external libraries (no `react-markdown`, `marked`, etc.).
- Never use `dangerouslySetInnerHTML`. Markdown parsed safely into standard React elements.
- Ensure all outbound GitHub API calls carry explicit 5-second timeouts and 30-minute caching in `localStorage`.
- All tests must pass with 100% success across the test suite (`npm test`).

---

### Task 1: Extend updateChecker Service with Release List & Distance Calculation

**Files:**
- Modify: `src/services/updateChecker.ts`
- Test: `src/services/__tests__/updateChecker.test.ts`

**Interfaces:**
- Consumes: `APP_VERSION`, `parseSemver`, `isNewerVersion`
- Produces: `ReleaseItem`, `fetchReleasesList(force?: boolean): Promise<ReleaseItem[]>`, `calculateVersionDistance(releases: ReleaseItem[], currentVersion: string)`

- [ ] **Step 1: Write failing unit tests for `fetchReleasesList` and `calculateVersionDistance`**

Add to `src/services/__tests__/updateChecker.test.ts`:
```ts
describe('calculateVersionDistance', () => {
  const mockReleases: ReleaseItem[] = [
    { id: 3, tagName: 'v0.7.2', name: 'Release 0.7.2', publishedAt: '2026-09-18', body: '', htmlUrl: '', isPrerelease: false },
    { id: 2, tagName: 'v0.7.1', name: 'Release 0.7.1', publishedAt: '2026-09-15', body: '', htmlUrl: '', isPrerelease: false },
    { id: 1, tagName: 'v0.7.0', name: 'Release 0.7.0', publishedAt: '2026-09-10', body: '', htmlUrl: '', isPrerelease: false },
  ];

  it('identifies up to date when current matches latest', () => {
    const res = calculateVersionDistance(mockReleases, '0.7.2');
    expect(res.isLatest).toBe(true);
    expect(res.behindCount).toBe(0);
    expect(res.latestVersion).toBe('0.7.2');
  });

  it('calculates behind count accurately when current is older', () => {
    const res = calculateVersionDistance(mockReleases, '0.7.0');
    expect(res.isLatest).toBe(false);
    expect(res.behindCount).toBe(2);
    expect(res.latestVersion).toBe('0.7.2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/updateChecker.test.ts`
Expected: FAIL due to missing functions.

- [ ] **Step 3: Implement `fetchReleasesList` & `calculateVersionDistance` in `src/services/updateChecker.ts`**

- Add `ReleaseItem` interface.
- Add `GITHUB_API_RELEASES = 'https://api.github.com/repos/rzkfyn/openterm/releases?per_page=15'`.
- Add `fetchReleasesList(force = false)` with timeout, JSON parsing, mapping, and `localStorage['openterm_cached_releases']` caching.
- Add `calculateVersionDistance(releases, currentVersion)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__/updateChecker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/services/
git commit -m "feat(update): add release list fetching and version distance calculator"
```

---

### Task 2: Extend updateStore with Changelog State & Actions

**Files:**
- Modify: `src/stores/updateStore.ts`
- Test: `src/stores/__tests__/updateStore.test.ts`

**Interfaces:**
- Consumes: `fetchReleasesList`, `calculateVersionDistance`
- Produces: `useUpdateStore` state (`releases`, `isChangelogOpen`, `selectedReleaseTag`, `openChangelog`, `closeChangelog`, `selectRelease`, `fetchReleases`)

- [ ] **Step 1: Write unit tests for changelog store actions**

Create/update `src/stores/__tests__/updateStore.test.ts`:
- Test initial changelog state: `isChangelogOpen: false`, `releases: []`, `selectedReleaseTag: null`.
- Test `openChangelog(tag?)` sets `isChangelogOpen: true` and loads releases.
- Test `closeChangelog()` resets open state.
- Test `selectRelease(tag)` changes `selectedReleaseTag`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/updateStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/stores/updateStore.ts`**

- Implement `releases`, `isLoadingReleases`, `isChangelogOpen`, `selectedReleaseTag`.
- Implement `openChangelog`, `closeChangelog`, `selectRelease`, `fetchReleases`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/stores/__tests__/updateStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/stores/
git commit -m "feat(store): add changelog modal and release selection state"
```

---

### Task 3: Build Safe Zero-Dependency Markdown Renderer

**Files:**
- Create: `src/components/Common/MarkdownRenderer.tsx`
- Create: `src/components/Common/__tests__/MarkdownRenderer.test.tsx`

**Interfaces:**
- Consumes: React
- Produces: `MarkdownRenderer: React.FC<{ content: string; className?: string }>`

- [ ] **Step 1: Write unit tests for MarkdownRenderer**

Create `src/components/Common/__tests__/MarkdownRenderer.test.tsx`:
- Renders headings (`#`, `##`, `###`).
- Renders list items (`- `, `* `).
- Renders code spans and code blocks.
- Renders links safely.
- Handles empty or invalid markdown without throwing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Common/__tests__/MarkdownRenderer.test.tsx`
Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `src/components/Common/MarkdownRenderer.tsx`**

- Implement lightweight block-based parser dividing text by lines.
- Transform headings, fenced code blocks, bullet points, blockquotes, and inline bold/code.
- Return pure React nodes without `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Common/__tests__/MarkdownRenderer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/Common/
git commit -m "feat(ui): implement safe zero-dependency markdown renderer"
```

---

### Task 4: Build In-App ChangelogModal Component

**Files:**
- Create: `src/components/Modal/ChangelogModal.tsx`
- Create: `src/components/Modal/__tests__/ChangelogModal.test.tsx`

**Interfaces:**
- Consumes: `useUpdateStore`, `MarkdownRenderer`, `tauriApi.openUrl`
- Produces: `ChangelogModal: React.FC`

- [ ] **Step 1: Write unit tests for ChangelogModal**

Create `src/components/Modal/__tests__/ChangelogModal.test.tsx`:
- Does not render when `isChangelogOpen: false`.
- Renders modal when `isChangelogOpen: true`.
- Displays version distance indicator in header (e.g. "2 versions behind").
- Renders release items in left sidebar with `[Current]` and `[Latest]` badges.
- Selects clicked release and displays markdown content in right pane.
- Clicking "Download Update" calls `tauriApi.openUrl` with release link.
- Dismisses via close button and Escape key.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Modal/__tests__/ChangelogModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/Modal/ChangelogModal.tsx`**

- Dual-pane layout: 260px release list + scrollable markdown detail.
- Status badges: `[Current]`, `[Latest]`, `[New]`.
- Top header with version distance counter and refresh button.
- Action buttons: "Download Update" & "View on GitHub".
- Backdrop click and Escape dismiss.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Modal/__tests__/ChangelogModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/Modal/ChangelogModal.tsx src/components/Modal/__tests__/ChangelogModal.test.tsx
git commit -m "feat(ui): create in-app changelog modal with version tracking"
```

---

### Task 5: Wire Changelog Triggers in StatusBar, SettingsModal & App

**Files:**
- Modify: `src/components/Layout/StatusBar.tsx`
- Modify: `src/components/Modal/SettingsModal.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/Layout/__tests__/statusBarChangelog.test.tsx`

**Interfaces:**
- Consumes: `useUpdateStore.getState().openChangelog`
- Produces: Seamless modal launch from StatusBar update pill, version tag, and Settings about tab

- [ ] **Step 1: Write unit test for StatusBar trigger**

Verify clicking the update button or version tag calls `openChangelog`.

- [ ] **Step 2: Update StatusBar, SettingsModal, and App**

1. In `src/components/Layout/StatusBar.tsx`:
   - Replace direct browser launch with `openChangelog()`.
2. In `src/components/Modal/SettingsModal.tsx`:
   - In About tab, "Release Notes" button calls `openChangelog()`.
3. In `src/App.tsx`:
   - Mount `<ChangelogModal />`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All test suites pass.

- [ ] **Step 4: Commit changes**

```bash
git add src/components/Layout/StatusBar.tsx src/components/Modal/SettingsModal.tsx src/App.tsx
git commit -m "feat(ui): connect in-app changelog triggers across status bar and settings"
```

---

### Task 5: End-to-End Verification & Build Test

- [ ] **Step 1: Run full test suite**
Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Build verification**
Run: `npm run build`
Expected: Build passes with 0 type errors.
