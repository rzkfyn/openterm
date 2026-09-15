import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon, ISearchOptions } from '@xterm/addon-search';
import { tauriApi } from '../../services/tauri';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  useSessionStore,
  attachTerminalSubscriber,
  detachTerminalSubscriber,
} from '../../stores/sessionStore';
import { useFileManagerStore } from '../../stores/fileManagerStore';
import { parseOsc7Path, syncCoordinator } from '../../utils/syncUtils';
import { shouldProcessPaste } from './pasteTracker';
import {
  applyShiftArrowSelection,
  clearKeyboardSelection,
  KeyboardSelectionState,
} from './terminalSelection';

export function useTerminalSession(sessionId: string | null, onTriggerSearch?: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onTriggerSearchRef = useRef(onTriggerSearch);
  onTriggerSearchRef.current = onTriggerSearch;

  const [searchResult, setSearchResult] = useState<{ resultIndex: number; resultCount: number } | null>(null);
  const currentTheme = useThemeStore((s) => s.theme);
  const settings = useSettingsStore((s) => s.settings);

  // Sync theme changes to live xterm instance
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = currentTheme.xterm;
    }
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = currentTheme.xterm.background;
    }
  }, [currentTheme]);

  // Sync settings (font, cursor, scrollback) to live xterm instance
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontFamily = settings.fontFamily;
      terminalRef.current.options.fontSize = settings.fontSize;
      terminalRef.current.options.lineHeight = settings.lineHeight;
      terminalRef.current.options.cursorBlink = settings.cursorBlink;
      terminalRef.current.options.cursorStyle = settings.cursorStyle;
      terminalRef.current.options.scrollback = settings.scrollback;
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }
  }, [settings]);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    // 1. Initialize xterm.js matching active theme preset and settings
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      scrollback: settings.scrollback,
      theme: currentTheme.xterm,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon({
      highlightLimit: 1000,
    });
    searchAddonRef.current = searchAddon;

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    const searchResultsDisposable = searchAddon.onDidChangeResults((e) => {
      setSearchResult(e);
    });

    // Register OSC 7 parser for Terminal -> SFTP directory synchronization
    const osc7Disposable = term.parser.registerOscHandler(7, (data: string) => {
      const parsed = parseOsc7Path(data);
      if (parsed && sessionId) {
        const autoSync = localStorage.getItem('openterm_sftp_auto_sync') !== 'false';
        if (autoSync && syncCoordinator.shouldSync(parsed, 'terminal')) {
          const currentRemote = useFileManagerStore.getState().remote.currentPath;
          if (currentRemote !== parsed) {
            useFileManagerStore.getState().loadRemoteDir(sessionId, parsed);
          }
        }
      }
      return true;
    });

    const keyboardSelectionRef = { current: null as KeyboardSelectionState | null };

    // Attach custom keyboard handler for copy / paste / select all
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Shift + Arrow keys: Block/select text without sending VT escape sequences (which leak A, B, C, D)
      if (
        event.type === 'keydown' &&
        event.shiftKey &&
        (event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown')
      ) {
        event.preventDefault();
        event.stopPropagation();
        applyShiftArrowSelection(term, event.key, keyboardSelectionRef);
        return false;
      }

      // Normal arrow keys without Shift: clear keyboard selection and let shell move cursor
      if (
        event.type === 'keydown' &&
        !event.shiftKey &&
        (event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown')
      ) {
        clearKeyboardSelection(term, keyboardSelectionRef);
      }

      // Find / Search in Terminal: Cmd/Ctrl + F
      if (event.type === 'keydown' && isCtrlOrCmd && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        event.stopPropagation();
        onTriggerSearchRef.current?.();
        return false;
      }

      // Copy: Ctrl+Shift+C or Ctrl+C when text is selected
      if (event.type === 'keydown' && isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) {
        if (event.shiftKey || term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            return false;
          }
        }
      }

      // Terminal Font Zoom In: Cmd/Ctrl + '+' or '='
      if (
        event.type === 'keydown' &&
        isCtrlOrCmd &&
        (event.key === '=' || event.key === '+' || event.code === 'Equal' || event.code === 'NumpadAdd')
      ) {
        event.preventDefault();
        event.stopPropagation();
        useSettingsStore.getState().increaseTerminalFontSize();
        return false;
      }

      // Terminal Font Zoom Out: Cmd/Ctrl + '-' or '_'
      if (
        event.type === 'keydown' &&
        isCtrlOrCmd &&
        (event.key === '-' || event.key === '_' || event.code === 'Minus' || event.code === 'NumpadSubtract')
      ) {
        event.preventDefault();
        event.stopPropagation();
        useSettingsStore.getState().decreaseTerminalFontSize();
        return false;
      }

      // Terminal Font Zoom Reset: Cmd/Ctrl + '0'
      if (
        event.type === 'keydown' &&
        isCtrlOrCmd &&
        (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0')
      ) {
        event.preventDefault();
        event.stopPropagation();
        useSettingsStore.getState().resetTerminalFontSize();
        return false;
      }

      // Paste: Ctrl+V (or Ctrl+Shift+V)
      if (event.type === 'keydown' && isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) {
        event.preventDefault();
        event.stopPropagation();
        navigator.clipboard
          .readText()
          .then((clipText) => {
            if (clipText && sessionId && shouldProcessPaste(clipText)) {
              term.paste(clipText);
            }
          })
          .catch(() => {});
        return false;
      }

      // Select All: Ctrl+Shift+A
      if (event.type === 'keydown' && isCtrlOrCmd && event.shiftKey && (event.key === 'a' || event.key === 'A')) {
        term.selectAll();
        return false;
      }

      return true;
    });

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Suppress middle-click paste that causes accidental paste artifacts
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };
    const el = containerRef.current;
    el.addEventListener('auxclick', handleAuxClick);

    term.writeln(`\x1b[38;5;105m[OpenTerm]\x1b[0m Connected to session \x1b[38;5;222m${sessionId}\x1b[0m\r\n`);

    // 2. Stream user keystrokes to Rust backend with async coalescing
    let pendingWrite = '';
    let isWriting = false;

    const flushQueue = async () => {
      if (isWriting || !pendingWrite) return;
      isWriting = true;
      const toSend = pendingWrite;
      pendingWrite = '';
      try {
        await tauriApi.sshWrite(sessionId, toSend);
      } catch (err) {
        console.error('Failed to write to SSH session:', err);
      } finally {
        isWriting = false;
        if (pendingWrite) {
          flushQueue();
        }
      }
    };

    const onDataDisposable = term.onData((data) => {
      pendingWrite += data;
      flushQueue();
    });

    // 3. Attach to session stream registry:
    //    replays all buffered data and streams live data.
    const { buffered } = attachTerminalSubscriber(sessionId, (chunk) => {
      term.write(chunk);
    });

    if (buffered.length > 0) {
      term.write(buffered.join(''));
    }

    let unlistenClosed: (() => void) | null = null;
    tauriApi
      .onSshClosed(sessionId, () => {
        term.writeln('\r\n\x1b[31m[Session closed by remote host]\x1b[0m\r\n');
        useSessionStore.getState().markSessionClosed(sessionId);
      })
      .then((unlisten) => {
        unlistenClosed = unlisten;
      });

    // 4. Resize handling — notify SSH server of actual terminal size
    const sendResize = () => {
      try {
        if (!containerRef.current || !terminalRef.current || !fitAddonRef.current) return;
        fitAddon.fit();
        const { cols, rows } = term;
        if (cols > 0 && rows > 0) {
          tauriApi.sshResizePty(sessionId, cols, rows).catch(() => {});
        }
      } catch (e) {
        // Suppress layout race condition warnings during unmount
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sendResize();
      }, 30);
    };

    const resizeObserver = new ResizeObserver(() => debouncedResize());
    resizeObserver.observe(containerRef.current);

    // Initial fit + resize after layout and fonts settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sendResize();
        term.focus();
      });
    });

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        sendResize();
      });
    }

    return () => {
      osc7Disposable.dispose();
      el.removeEventListener('auxclick', handleAuxClick);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      searchResultsDisposable.dispose();
      detachTerminalSubscriber(sessionId);
      if (unlistenClosed) unlistenClosed();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sessionId]);

  // Re-fit xterm when view mode changes (e.g. from hidden sftp to split/terminal)
  const viewMode = useSessionStore((s) => s.viewMode);
  useEffect(() => {
    if (viewMode !== 'sftp' && fitAddonRef.current && terminalRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
          terminalRef.current?.focus();
        } catch (e) {}
      });
    }
  }, [viewMode]);

  const copySelection = () => {
    if (terminalRef.current?.hasSelection()) {
      const text = terminalRef.current.getSelection();
      if (text) navigator.clipboard.writeText(text).catch(() => {});
    }
    terminalRef.current?.focus();
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && sessionId && shouldProcessPaste(text)) {
        if (terminalRef.current) {
          terminalRef.current.paste(text);
        } else {
          await tauriApi.sshWrite(sessionId, text);
        }
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    } finally {
      terminalRef.current?.focus();
    }
  };

  const selectAll = () => {
    terminalRef.current?.selectAll();
    terminalRef.current?.focus();
  };

  const clearTerminal = () => {
    terminalRef.current?.clear();
    terminalRef.current?.focus();
  };

  const resetTerminal = () => {
    if (terminalRef.current) {
      terminalRef.current.reset();
      terminalRef.current.focus();
    }
    if (sessionId) {
      // Clear DECSET mouse tracking modes (1000, 1002, 1003, 1006), reset text attributes, and clear screen
      tauriApi.sshWrite(sessionId, '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[0m\x0c').catch(() => {});
    }
  };

  const findNext = (termStr: string, options?: ISearchOptions) => {
    if (!searchAddonRef.current || !termStr) return false;
    try {
      return searchAddonRef.current.findNext(termStr, options);
    } catch (err) {
      console.warn('xterm findNext search error:', err);
      return false;
    }
  };

  const findPrevious = (termStr: string, options?: ISearchOptions) => {
    if (!searchAddonRef.current || !termStr) return false;
    try {
      return searchAddonRef.current.findPrevious(termStr, options);
    } catch (err) {
      console.warn('xterm findPrevious search error:', err);
      return false;
    }
  };

  const clearSearch = () => {
    try {
      if (searchAddonRef.current) {
        searchAddonRef.current.clearDecorations();
        searchAddonRef.current.clearActiveDecoration();
      }
    } catch (err) {
      console.warn('xterm clearSearch error:', err);
    }
    setSearchResult(null);
  };

  const getSelection = () => {
    return terminalRef.current?.getSelection() || '';
  };

  return {
    containerRef,
    terminal: terminalRef.current,
    copySelection,
    pasteFromClipboard,
    selectAll,
    clearTerminal,
    resetTerminal,
    findNext,
    findPrevious,
    clearSearch,
    searchResult,
    getSelection,
  };
}
