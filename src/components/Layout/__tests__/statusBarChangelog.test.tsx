import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../services/tauri', () => ({
  tauriApi: {
    openUrl: vi.fn(),
  },
}));

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

vi.mock('../../../stores/settingsStore', async () => {
  const actual = await vi.importActual<typeof import('../../../stores/settingsStore')>(
    '../../../stores/settingsStore'
  );
  const mockUseSettingsStore = ((selector?: (s: any) => any) => {
    const state = actual.useSettingsStore.getState();
    return selector ? selector(state) : state;
  }) as typeof actual.useSettingsStore;
  Object.assign(mockUseSettingsStore, actual.useSettingsStore);
  return {
    ...actual,
    useSettingsStore: mockUseSettingsStore,
  };
});
import { useUpdateStore } from '../../../stores/updateStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { StatusBar } from '../StatusBar';
import { SettingsModal } from '../../Modal/SettingsModal';

function findElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(n: any) {
    if (!n || typeof n !== 'object') return;
    if (predicate(n)) {
      results.push(n);
    }
    if (n.props && n.props.children) {
      const children = Array.isArray(n.props.children)
        ? n.props.children
        : [n.props.children];
      for (const child of children) {
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else {
          traverse(child);
        }
      }
    }
  }
  traverse(node);
  return results;
}

function findElement(node: any, predicate: (n: any) => boolean): any | null {
  const list = findElements(node, predicate);
  return list.length > 0 ? list[0] : null;
}

describe('StatusBar and Settings Changelog Triggers', () => {
  const mockOpenChangelog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      currentVersion: '0.7.1',
      latestVersion: null,
      hasUpdate: false,
      dismissed: false,
      isChecking: false,
      checkStatus: 'idle',
      openChangelog: mockOpenChangelog,
    });
  });

  function renderStatusBar() {
    let captured: React.ReactElement | null = null;
    function Wrapper() {
      captured = StatusBar({}) as React.ReactElement<any>;
      return captured;
    }
    const html = renderToStaticMarkup(React.createElement(Wrapper));
    return { tree: captured!, html };
  }

  function renderSettingsModal() {
    let captured: React.ReactElement | null = null;
    function Wrapper() {
      captured = SettingsModal({}) as React.ReactElement<any>;
      return captured;
    }
    const html = renderToStaticMarkup(React.createElement(Wrapper));
    return { tree: captured!, html };
  }

  it('calls openChangelog when clicking the version indicator button', () => {
    const { tree } = renderStatusBar();
    const versionBtn = findElement(tree, (n) =>
      n.type === 'button' && (n.props?.title?.includes('0.7.1') || JSON.stringify(n.props?.children).includes('v0.7.1'))
    );

    expect(versionBtn).toBeTruthy();
    versionBtn.props.onClick();

    expect(mockOpenChangelog).toHaveBeenCalledTimes(1);
  });

  it('calls openChangelog with latestVersion when clicking update notification pill', () => {
    useUpdateStore.setState({
      currentVersion: '0.7.1',
      latestVersion: '0.7.2',
      hasUpdate: true,
      dismissed: false,
      openChangelog: mockOpenChangelog,
    });

    const { tree } = renderStatusBar();
    const updateBtn = findElement(tree, (n) =>
      n.type === 'button' && n.props?.title?.includes('0.7.2')
    );

    expect(updateBtn).toBeTruthy();
    updateBtn.props.onClick();

    expect(mockOpenChangelog).toHaveBeenCalledWith('0.7.2');
  });

  it('calls openChangelog on right click context menu of version indicator', () => {
    const { tree } = renderStatusBar();
    const versionBtn = findElement(tree, (n) =>
      n.type === 'button' && (n.props?.title?.includes('0.7.1') || JSON.stringify(n.props?.children).includes('v0.7.1'))
    );

    expect(versionBtn).toBeTruthy();
    const preventDefault = vi.fn();
    versionBtn.props.onContextMenu?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(mockOpenChangelog).toHaveBeenCalled();
  });

  it('does not render update pill when update is dismissed', () => {
    useUpdateStore.setState({
      currentVersion: '0.7.1',
      latestVersion: '0.7.2',
      hasUpdate: true,
      dismissed: true,
      openChangelog: mockOpenChangelog,
    });

    const { tree } = renderStatusBar();
    const updateBtn = findElement(tree, (n) =>
      n.type === 'button' && n.props?.title?.includes('0.7.2')
    );

    expect(updateBtn).toBeNull();
  });

  it('calls openChangelog when clicking "View Changelog" button in SettingsModal About tab', () => {
    useSettingsStore.setState({
      isOpen: true,
      activeTab: 'about',
    });

    const { tree } = renderSettingsModal();
    const changelogBtn = findElement(tree, (n) =>
      n.type === 'button' && JSON.stringify(n.props?.children).includes('Changelog')
    );

    expect(changelogBtn).toBeTruthy();
    changelogBtn.props.onClick();

    expect(mockOpenChangelog).toHaveBeenCalledTimes(1);
  });
});
