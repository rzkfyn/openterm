import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { tauriApi } from '../../services/tauri';
import {
  useSessionStore,
  attachTerminalSubscriber,
  detachTerminalSubscriber,
} from '../../stores/sessionStore';

export function useTerminalSession(sessionId: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    // 1. Initialize xterm.js matching the custom dark midnight palette
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", "Cascadia Code", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: {
        background: '#13131d',
        foreground: '#e2e8f0',
        cursor: '#818cf8',
        selectionBackground: 'rgba(99, 102, 241, 0.3)',
        black: '#11111a',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#6366f1',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#818cf8',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

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

  return { containerRef, terminal: terminalRef.current };
}
