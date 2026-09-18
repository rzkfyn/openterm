import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReleaseItem } from '../../../services/updateChecker';

// Global mocks
const mockOpenUrl = vi.fn().mockResolvedValue(undefined);
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
let effectCleanups: (() => void)[] = [];

vi.mock('../../../services/tauri', () => ({
  tauriApi: {
    openUrl: (...args: any[]) => mockOpenUrl(...args),
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: (fn: () => any) => {
      const cleanup = fn();
      if (typeof cleanup === 'function') {
        effectCleanups.push(cleanup);
      }
    },
  };
});

vi.mock('../../../stores/updateStore', async () => {
  const actual = await vi.importActual<typeof import('../../../stores/updateStore')>(
    '../../../stores/updateStore'
  );
  const mockUseUpdateStore = ((selector?: (s: any) => any) => {
    const state = actual.useUpdateStore.getState();
    return selector ? selector(state) : state;
  }) as typeof actual.useUpdateStore;
  Object.assign(mockUseUpdateStore, actual.useUpdateStore);
  return {
    ...actual,
    useUpdateStore: mockUseUpdateStore,
  };
});

import { useUpdateStore } from '../../../stores/updateStore';
import { ChangelogModal } from '../ChangelogModal';

function findElement(node: any, predicate: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children.flat(Infinity)
      : [node.props.children];
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

const mockReleases: ReleaseItem[] = [
  {
    id: 102,
    tagName: 'v0.7.2',
    name: 'v0.7.2 - Terminal Sync & UI',
    publishedAt: '2026-09-18T12:00:00Z',
    body: '## New Features\n- Added changelog modal\n- Fixed scroll bug',
    htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.2',
    isPrerelease: false,
  },
  {
    id: 101,
    tagName: 'v0.7.1',
    name: 'v0.7.1 - Bug Fixes',
    publishedAt: '2026-09-15T12:00:00Z',
    body: '## Bug Fixes\n- Fixed crash on connection',
    htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.1',
    isPrerelease: false,
  },
  {
    id: 100,
    tagName: 'v0.7.0',
    name: 'v0.7.0 - Initial Release',
    publishedAt: '2026-09-01T12:00:00Z',
    body: '',
    htmlUrl: 'https://github.com/rzkfyn/openterm/releases/tag/v0.7.0',
    isPrerelease: false,
  },
];

describe('ChangelogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCleanups = [];

    vi.stubGlobal('window', {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      open: vi.fn(),
    });

    useUpdateStore.setState({
      currentVersion: '0.7.1',
      latestVersion: null,
      releaseUrl: null,
      hasUpdate: false,
      isChecking: false,
      dismissed: false,
      checkStatus: 'idle',
      releases: [],
      isLoadingReleases: false,
      isChangelogOpen: false,
      selectedReleaseTag: null,
    });
  });

  afterEach(() => {
    effectCleanups.forEach((c) => c());
    vi.unstubAllGlobals();
  });

  it('does not render when isChangelogOpen is false', () => {
    useUpdateStore.setState({ isChangelogOpen: false });
    const element = ChangelogModal({});
    expect(element).toBeNull();
  });

  it('renders modal container, header, and dialog attributes when isChangelogOpen is true', () => {
    useUpdateStore.setState({
      isChangelogOpen: true,
      releases: mockReleases,
      selectedReleaseTag: 'v0.7.2',
    });

    const element = ChangelogModal({}) as React.ReactElement<any>;
    expect(element).not.toBeNull();

    const html = renderToStaticMarkup(element);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Changelog');
    expect(html).toContain("Browse what&#x27;s new in each release");
  });

  describe('Version Distance Badge in Header', () => {
    it('shows emerald badge when app is up to date', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.2',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('v0.7.2 · Up to date ✓');
      expect(html).toContain('text-emerald-400');
    });

    it('shows amber badge with behind count when behind latest release (2 versions behind)', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.0',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('v0.7.0 · 2 versions behind latest v0.7.2');
      expect(html).toContain('text-amber-400');
    });

    it('shows singular "version" when 1 version behind latest release', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('v0.7.1 · 1 version behind latest v0.7.2');
      expect(html).toContain('text-amber-400');
    });

    it('shows neutral fallback badge when loading or no releases', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: [],
        isLoadingReleases: true,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('v0.7.1 · Current');
    });
  });

  describe('Left Sidebar Release List', () => {
    it('renders release items with [Latest], [Current], and [New] badges', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);

      // Check all release tags are rendered
      expect(html).toContain('v0.7.2');
      expect(html).toContain('v0.7.1');
      expect(html).toContain('v0.7.0');

      // Check formatted dates
      expect(html).toContain('Sep 18, 2026');
      expect(html).toContain('Sep 15, 2026');
      expect(html).toContain('Sep 1, 2026');

      // Badges
      expect(html).toContain('Latest');
      expect(html).toContain('Current');
      expect(html).toContain('New');
    });

    it('allows clicking a release item to switch selection', () => {
      const mockSelectRelease = vi.fn();
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
        selectRelease: mockSelectRelease,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const v71Btn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-tag'] === 'v0.7.1'
      );
      expect(v71Btn).toBeDefined();
      v71Btn.props.onClick();
      expect(mockSelectRelease).toHaveBeenCalledWith('v0.7.1');
    });

    it('displays loading state when isLoadingReleases is true and releases is empty', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: [],
        isLoadingReleases: true,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('Loading releases...');
    });

    it('displays empty state when not loading and releases is empty', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: [],
        isLoadingReleases: false,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('No releases found');
    });
  });

  describe('Right Content Pane', () => {
    it('renders selected release notes with MarkdownRenderer', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);

      // Selected release header
      expect(html).toContain('v0.7.2 - Terminal Sync &amp; UI');
      expect(html).toContain('Download Update');
      expect(html).toContain('View on GitHub');

      // Release body parsed via MarkdownRenderer
      expect(html).toContain('New Features');
      expect(html).toContain('Added changelog modal');
      expect(html).toContain('Fixed scroll bug');
    });

    it('renders empty notice when selected release has empty body', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.0',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);

      expect(html).toContain('v0.7.0 - Initial Release');
      expect(html).toContain('No release notes provided for this version.');
    });

    it('renders placeholder when no release is selected', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: null,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const html = renderToStaticMarkup(element);

      expect(html).toContain('Select a release to view notes.');
    });

    it('calls tauriApi.openUrl when clicking Download Update', async () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const downloadBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-action'] === 'download'
      );

      expect(downloadBtn).toBeDefined();
      await downloadBtn.props.onClick();

      expect(mockOpenUrl).toHaveBeenCalledWith(mockReleases[0].htmlUrl);
    });

    it('calls tauriApi.openUrl when clicking View on GitHub', async () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const viewGithubBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-action'] === 'github'
      );

      expect(viewGithubBtn).toBeDefined();
      await viewGithubBtn.props.onClick();

      expect(mockOpenUrl).toHaveBeenCalledWith(mockReleases[0].htmlUrl);
    });
  });

  describe('Modal Controls and Dismissal', () => {
    it('calls closeChangelog when close button is clicked', () => {
      const mockCloseChangelog = vi.fn();
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
        closeChangelog: mockCloseChangelog,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const closeBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['aria-label'] === 'Close changelog'
      );

      expect(closeBtn).toBeDefined();
      closeBtn.props.onClick();

      expect(mockCloseChangelog).toHaveBeenCalledTimes(1);
    });

    it('calls closeChangelog on backdrop click', () => {
      const mockCloseChangelog = vi.fn();
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
        closeChangelog: mockCloseChangelog,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const backdropEvent = {
        target: 'backdrop-container',
        currentTarget: 'backdrop-container',
      };
      element.props.onClick(backdropEvent);

      expect(mockCloseChangelog).toHaveBeenCalledTimes(1);
    });

    it('stops propagation when clicking on modal card', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const modalCard = element.props.children;
      const stopProp = vi.fn();

      modalCard.props.onClick({ stopPropagation: stopProp });
      expect(stopProp).toHaveBeenCalledTimes(1);
    });

    it('registers Escape key listener and calls closeChangelog when Escape is pressed', () => {
      const mockCloseChangelog = vi.fn();
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
        closeChangelog: mockCloseChangelog,
      });

      ChangelogModal({});
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

      const keydownCall = mockAddEventListener.mock.calls.find((c) => c[0] === 'keydown');
      expect(keydownCall).toBeDefined();
      const handler = keydownCall![1];

      // Non-Escape does nothing
      handler({ key: 'Enter' });
      expect(mockCloseChangelog).not.toHaveBeenCalled();

      // Escape triggers close
      handler({ key: 'Escape' });
      expect(mockCloseChangelog).toHaveBeenCalledTimes(1);
    });

    it('calls fetchReleases(true) when Check for Updates button is clicked', () => {
      const mockFetchReleases = vi.fn();
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
        fetchReleases: mockFetchReleases,
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const refreshBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['aria-label'] === 'Check for updates'
      );

      expect(refreshBtn).toBeDefined();
      refreshBtn.props.onClick();

      expect(mockFetchReleases).toHaveBeenCalledWith(true);
    });
    it('falls back to window.open if tauriApi.openUrl rejects', async () => {
      const mockWindowOpen = vi.fn();
      vi.stubGlobal('window', {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        open: mockWindowOpen,
      });
      mockOpenUrl.mockRejectedValueOnce(new Error('Tauri not available'));

      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const downloadBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-action'] === 'download'
      );

      await downloadBtn.props.onClick();
      await Promise.resolve(); // flush rejection handling

      expect(mockWindowOpen).toHaveBeenCalledWith(
        mockReleases[0].htmlUrl,
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('cleans up keydown listener when effect cleans up', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      ChangelogModal({});
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Execute cleanups
      effectCleanups.forEach((c) => c());
      expect(mockRemoveEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('applies active styling to selected release in sidebar and inactive to others', () => {
      useUpdateStore.setState({
        isChangelogOpen: true,
        currentVersion: '0.7.1',
        releases: mockReleases,
        selectedReleaseTag: 'v0.7.2',
      });

      const element = ChangelogModal({}) as React.ReactElement<any>;
      const selectedBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-tag'] === 'v0.7.2'
      );
      const inactiveBtn = findElement(
        element,
        (n) => n.type === 'button' && n.props && n.props['data-tag'] === 'v0.7.1'
      );

      expect(selectedBtn.props.className).toContain('bg-white/10');
      expect(selectedBtn.props.className).toContain('border-indigo-500/40');
      expect(inactiveBtn.props.className).toContain('bg-transparent');
      expect(inactiveBtn.props.className).toContain('border-transparent');
    });
  });
});
