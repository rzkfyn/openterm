import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Global mocks
const mockWriteText = vi.fn().mockResolvedValue(undefined);
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

let currentTab: 'bash' | 'zsh' | 'fish' = 'bash';
let currentCopied = false;
const mockSetActiveTab = vi.fn((tab) => {
  currentTab = tab;
});
const mockSetCopied = vi.fn((copied) => {
  currentCopied = copied;
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => {
      if (initial === 'bash' || initial === 'zsh' || initial === 'fish') {
        return [currentTab, mockSetActiveTab];
      }
      return [currentCopied, mockSetCopied];
    },
    useEffect: (fn: () => any) => {
      fn();
    },
    useRef: (initial: any) => ({ current: initial }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  currentTab = 'bash';
  currentCopied = false;

  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: mockWriteText,
    },
  });

  vi.stubGlobal('window', {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import {
  Osc7SetupModal,
  SHELL_CONFIGS,
} from '../Osc7SetupModal';

describe('Osc7SetupModal', () => {
  it('returns null and renders nothing when isOpen is false', () => {
    const onClose = vi.fn();
    const element = Osc7SetupModal({ isOpen: false, onClose });
    expect(element).toBeNull();
  });

  it('renders modal header, description, tabs, and default bash snippet when isOpen is true', () => {
    const onClose = vi.fn();
    const element = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement;
    expect(element).not.toBeNull();

    const html = renderToStaticMarkup(element);

    // Header & title
    expect(html).toContain('Remote Shell OSC 7 Setup');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="osc7-modal-title"');

    // Description text explaining OSC 7 directory sync requirement
    expect(html).toContain('OSC 7 escape sequences');
    expect(html).toContain('OpenTerm');

    // Tab buttons
    expect(html).toContain('Bash');
    expect(html).toContain('Zsh');
    expect(html).toContain('Fish');

    // Default active tab is Bash
    expect(html).toContain('~/.bashrc');
    expect(html).toContain('source ~/.bashrc');
    expect(html).toContain('osc7_cwd()');
    expect(html).toContain('PROMPT_COMMAND');

    // Copy Snippet button
    expect(html).toContain('Copy Snippet');
  });

  it('contains exact required shell snippets and instructions for all 3 shells', () => {
    // Bash
    expect(SHELL_CONFIGS.bash.instruction).toBe(
      'Add to ~/.bashrc on the remote server, then run source ~/.bashrc.'
    );
    expect(SHELL_CONFIGS.bash.snippet).toContain('osc7_cwd()');
    expect(SHELL_CONFIGS.bash.snippet).toContain(
      'printf "\\033]7;file://%s%s\\033\\\\" "$HOSTNAME" "$PWD"'
    );
    expect(SHELL_CONFIGS.bash.snippet).toContain('PROMPT_COMMAND="osc7_cwd; $PROMPT_COMMAND"');

    // Zsh
    expect(SHELL_CONFIGS.zsh.instruction).toBe(
      'Add to ~/.zshrc on the remote server, then run source ~/.zshrc.'
    );
    expect(SHELL_CONFIGS.zsh.snippet).toContain('chpwd_osc7()');
    expect(SHELL_CONFIGS.zsh.snippet).toContain('print -n "\\e]7;file://${HOST}${PWD}\\a"');
    expect(SHELL_CONFIGS.zsh.snippet).toContain('autoload -Uz add-zsh-hook');
    expect(SHELL_CONFIGS.zsh.snippet).toContain('add-zsh-hook chpwd chpwd_osc7');

    // Fish
    expect(SHELL_CONFIGS.fish.instruction).toBe(
      'Add to ~/.config/fish/config.fish on the remote server.'
    );
    expect(SHELL_CONFIGS.fish.snippet).toContain('function emit_osc7 --on-variable PWD');
    expect(SHELL_CONFIGS.fish.snippet).toContain(
      "printf '\\e]7;file://%s%s\\e\\\\' (hostname) $PWD"
    );
    expect(SHELL_CONFIGS.fish.snippet).toContain('end');
  });

  it('switches shell snippets when clicking tabs', () => {
    const onClose = vi.fn();
    const element = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement<any>;

    // Outer backdrop -> card dialog -> body
    const card = element.props.children;
    const body = card.props.children[1];
    // body children: [0: description, 1: tabs container, 2: content block, 3: action row]
    const tabsContainer = body.props.children[1];
    const [, zshTab, fishTab] = tabsContainer.props.children;

    // Click Zsh tab
    zshTab.props.onClick();
    expect(mockSetActiveTab).toHaveBeenCalledWith('zsh');

    // Now render with Zsh active
    currentTab = 'zsh';
    const zshElement = Osc7SetupModal({ isOpen: true, onClose, defaultTab: 'zsh' }) as React.ReactElement;
    const zshHtml = renderToStaticMarkup(zshElement);
    expect(zshHtml).toContain('~/.zshrc');
    expect(zshHtml).toContain('chpwd_osc7');
    expect(zshHtml).toContain('add-zsh-hook');

    // Click Fish tab
    fishTab.props.onClick();
    expect(mockSetActiveTab).toHaveBeenCalledWith('fish');

    // Now render with Fish active
    currentTab = 'fish';
    const fishElement = Osc7SetupModal({ isOpen: true, onClose, defaultTab: 'fish' }) as React.ReactElement;
    const fishHtml = renderToStaticMarkup(fishElement);
    expect(fishHtml).toContain('config.fish');
    expect(fishHtml).toContain('function emit_osc7');
  });

  it('handles close button click', () => {
    const onClose = vi.fn();
    const element = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement<any>;

    const card = element.props.children;
    const header = card.props.children[0];
    const closeBtn = header.props.children[1];
    expect(closeBtn.props['aria-label']).toBe('Close');

    closeBtn.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles backdrop click dismissal', () => {
    const onClose = vi.fn();
    const element = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement<any>;

    // Backdrop click on outer container
    const backdropEvent = {
      target: 'backdrop-ref',
      currentTarget: 'backdrop-ref',
    };
    element.props.onClick(backdropEvent);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Inner dialog container click should stop propagation
    const innerStopPropagation = vi.fn();
    const card = element.props.children;
    card.props.onClick({ stopPropagation: innerStopPropagation });
    expect(innerStopPropagation).toHaveBeenCalledTimes(1);
  });

  it('copies active shell snippet to clipboard on copy click and shows Copied! text', async () => {
    const onClose = vi.fn();
    currentTab = 'bash';
    const element = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement<any>;

    const card = element.props.children;
    const body = card.props.children[1];
    const actionRow = body.props.children[3];
    const copyButton = actionRow.props.children[0];

    await copyButton.props.onClick();
    expect(mockWriteText).toHaveBeenCalledWith(SHELL_CONFIGS.bash.snippet);
    expect(mockSetCopied).toHaveBeenCalledWith(true);

    // When copied is true, renders Copied!
    currentCopied = true;
    const copiedElement = Osc7SetupModal({ isOpen: true, onClose }) as React.ReactElement;
    const copiedHtml = renderToStaticMarkup(copiedElement);
    expect(copiedHtml).toContain('Copied!');
  });

  it('copies zsh snippet to clipboard when zsh tab is active', async () => {
    const onClose = vi.fn();
    currentTab = 'zsh';
    const element = Osc7SetupModal({ isOpen: true, onClose, defaultTab: 'zsh' }) as React.ReactElement<any>;

    const card = element.props.children;
    const body = card.props.children[1];
    const actionRow = body.props.children[3];
    const copyButton = actionRow.props.children[0];

    await copyButton.props.onClick();
    expect(mockWriteText).toHaveBeenCalledWith(SHELL_CONFIGS.zsh.snippet);
  });

  it('copies fish snippet to clipboard when fish tab is active', async () => {
    const onClose = vi.fn();
    currentTab = 'fish';
    const element = Osc7SetupModal({ isOpen: true, onClose, defaultTab: 'fish' }) as React.ReactElement<any>;

    const card = element.props.children;
    const body = card.props.children[1];
    const actionRow = body.props.children[3];
    const copyButton = actionRow.props.children[0];

    await copyButton.props.onClick();
    expect(mockWriteText).toHaveBeenCalledWith(SHELL_CONFIGS.fish.snippet);
  });

  it('registers Escape key listener on window and calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    Osc7SetupModal({ isOpen: true, onClose });
    expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    // Retrieve the keydown handler registered by the component
    const call = mockAddEventListener.mock.calls.find((c) => c[0] === 'keydown');
    expect(call).toBeDefined();
    const keydownHandler = call![1];

    // Non-Escape key does not call onClose
    keydownHandler({ key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    // Escape key calls onClose
    keydownHandler({ key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
