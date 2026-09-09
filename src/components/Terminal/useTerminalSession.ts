import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { tauriApi } from '../../services/tauri';
import { useThemeStore } from '../../stores/themeStore';
import {
  useSessionStore,
  attachTerminalSubscriber,
  detachTerminalSubscriber,
} from '../../stores/sessionStore';

export function useTerminalSession(sessionId: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentTheme = useThemeStore((s) => s.theme);

  // Sync theme changes to live xterm instance
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = currentTheme.xterm;
    }
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = currentTheme.xterm.background;
    }
  }, [currentTheme]);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    // 1. Initialize xterm.js matching active theme preset
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", "Cascadia Code", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: currentTheme.xterm,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Attach custom keyboard handler for copy / paste / select all
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

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

      // Paste: Ctrl+V (or Ctrl+Shift+V)
      if (event.type === 'keydown' && isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) {
        navigator.clipboard
          .readText()
          .then((clipText) => {
            if (clipText && sessionId) {
              tauriApi.sshWrite(sessionId, clipText).catch(() => {});
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
      el.removeEventListener('auxclick', handleAuxClick);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      detachTerminalSubscriber(sessionId);
      if (unlistenClosed) unlistenClosed();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
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
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && sessionId) {
        await tauriApi.sshWrite(sessionId, text);
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    }
  };

  const selectAll = () => {
    terminalRef.current?.selectAll();
  };

  const clearTerminal = () => {
    terminalRef.current?.clear();
  };

  const resetTerminal = () => {
    if (terminalRef.current) {
      terminalRef.current.reset();
    }
    if (sessionId) {
      // Clear DECSET mouse tracking modes (1000, 1002, 1003, 1006), reset text attributes, and clear screen
      tauriApi.sshWrite(sessionId, '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[0m\x0c').catch(() => {});
    }
  };

  return {
    containerRef,
    terminal: terminalRef.current,
    copySelection,
    pasteFromClipboard,
    selectAll,
    clearTerminal,
    resetTerminal,
  };
}
