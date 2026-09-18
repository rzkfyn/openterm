import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

let osc7ModalState = false;
const mockSetIsOsc7ModalOpen = vi.fn((val: boolean | ((prev: boolean) => boolean)) => {
  osc7ModalState = typeof val === 'function' ? val(osc7ModalState) : val;
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => {
      // The only boolean-literal useState in SettingsModal is isOsc7ModalOpen (initial = false)
      if (initial === false) {
        return [osc7ModalState, mockSetIsOsc7ModalOpen];
      }
      if (typeof initial === 'function') {
        return [initial(), vi.fn()];
      }
      return [initial, vi.fn()];
    },
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

import { useSettingsStore, DEFAULT_SETTINGS } from '../../../stores/settingsStore';
import { SettingsModal } from '../SettingsModal';
import { Osc7SetupModal } from '../Osc7SetupModal';
function findElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(n: any) {
    if (!n) return;
    if (predicate(n)) {
      results.push(n);
    }
    if (n.props && n.props.children) {
      React.Children.forEach(n.props.children, traverse);
    }
  }
  traverse(node);
  return results;
}

function findElement(node: any, predicate: (n: any) => boolean): any | null {
  let found: any = null;
  function traverse(n: any) {
    if (found || !n) return;
    if (predicate(n)) {
      found = n;
      return;
    }
    if (n.props && n.props.children) {
      React.Children.forEach(n.props.children, traverse);
    }
  }
  traverse(node);
  return found;
}

function renderSettingsModal(): { tree: React.ReactElement; html: string } {
  let captured: React.ReactElement | null = null;
  function Wrapper() {
    captured = SettingsModal({}) as React.ReactElement<any>;
    return captured;
  }
  const html = renderToStaticMarkup(React.createElement(Wrapper));
  return { tree: captured!, html };
}

describe('SettingsModal SFTP Split Sync & OSC 7 Guide Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    osc7ModalState = false;
    useSettingsStore.setState({
      isOpen: true,
      activeTab: 'sftp',
      settings: {
        ...DEFAULT_SETTINGS,
        sftpSyncToTerminal: true,
        sftpSyncFromTerminal: false,
      },
    });
  });

  it('renders both "Sync SFTP to Terminal" and "Sync Terminal to SFTP" labels in SFTP tab', () => {
    const { html } = renderSettingsModal();

    // Verify dual toggle titles and descriptions
    expect(html).toContain('Sync SFTP to Terminal');
    expect(html).toContain('Send cd command to active terminal when navigating remote folders');
    expect(html).toContain('Sync Terminal to SFTP');
    expect(html).toContain('Follow terminal working directory via OSC 7 escape sequences');

    // Verify setup guide trigger button
    expect(html).toContain('View remote shell setup guide');

    // Verify old legacy label is removed
    expect(html).not.toContain('Terminal-SFTP Auto-Sync');
  });

  it('toggles both checkboxes and updates useSettingsStore independently', () => {
    const { tree } = renderSettingsModal();

    // Find all checkboxes in the SFTP tab (hidden files, syncToTerminal, syncFromTerminal)
    const checkboxes = findElements(
      tree,
      (n) => n.type === 'input' && n.props?.type === 'checkbox'
    );
    expect(checkboxes.length).toBe(3);

    const sftpToTerminalCheckbox = checkboxes[1];
    const sftpFromTerminalCheckbox = checkboxes[2];

    expect(sftpToTerminalCheckbox.props.checked).toBe(true);
    expect(sftpFromTerminalCheckbox.props.checked).toBe(false);

    // Toggle sftpSyncToTerminal off
    sftpToTerminalCheckbox.props.onChange({ target: { checked: false } });
    expect(useSettingsStore.getState().settings.sftpSyncToTerminal).toBe(false);
    expect(useSettingsStore.getState().settings.sftpSyncFromTerminal).toBe(false);

    // Toggle sftpSyncFromTerminal on
    sftpFromTerminalCheckbox.props.onChange({ target: { checked: true } });
    expect(useSettingsStore.getState().settings.sftpSyncToTerminal).toBe(false);
    expect(useSettingsStore.getState().settings.sftpSyncFromTerminal).toBe(true);

    // Toggle sftpSyncToTerminal back on
    sftpToTerminalCheckbox.props.onChange({ target: { checked: true } });
    expect(useSettingsStore.getState().settings.sftpSyncToTerminal).toBe(true);
    expect(useSettingsStore.getState().settings.sftpSyncFromTerminal).toBe(true);
  });

  it('opens Osc7SetupModal when clicking the (?) help button', () => {
    const { tree } = renderSettingsModal();

    // Verify Osc7SetupModal component is rendered in the tree with initial isOpen = false
    const osc7Modal = findElement(tree, (n) => n.type === Osc7SetupModal);
    expect(osc7Modal).not.toBeNull();
    expect(osc7Modal.props.isOpen).toBe(false);

    // Find the help button next to "Sync Terminal to SFTP"
    const helpButton = findElement(
      tree,
      (n) => n.type === 'button' && n.props?.title === 'View remote shell setup guide'
    );
    expect(helpButton).not.toBeNull();

    // Click the help button
    helpButton.props.onClick();
    expect(mockSetIsOsc7ModalOpen).toHaveBeenCalledWith(true);

    // When modal state is true, Osc7SetupModal receives isOpen = true
    osc7ModalState = true;
    const { tree: openTree } = renderSettingsModal();
    const openOsc7Modal = findElement(openTree, (n) => n.type === Osc7SetupModal);
    expect(openOsc7Modal.props.isOpen).toBe(true);

    // Calling onClose sets state back to false
    openOsc7Modal.props.onClose();
    expect(mockSetIsOsc7ModalOpen).toHaveBeenCalledWith(false);
  });
});
