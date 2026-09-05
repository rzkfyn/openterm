import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { tauriApi } from '../../services/tauri';
import { useSessionStore } from '../../stores/sessionStore';

export function useTerminalSession(sessionId: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    // 1. Initialize xterm.js instance
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
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

    term.writeln(`\x1b[38;5;39m[OpenTerm]\x1b[0m Connected to session \x1b[33m${sessionId}\x1b[0m\r\n`);

    // 2. Stream user keystrokes to Rust backend
    const onDataDisposable = term.onData((data) => {
      console.log('[xterm onData triggered]', JSON.stringify(data));
      tauriApi.sshWrite(sessionId, data).catch((err) => {
        console.error('Failed to write to SSH session:', err);
      });
    });

    // 3. Listen to incoming SSH bytes via Tauri event
    let unlistenData: (() => void) | null = null;
    let unlistenClosed: (() => void) | null = null;

    tauriApi
      .onSshData(sessionId, (chunk) => {
        console.log('[xterm onSshData received]', chunk.length, 'bytes');
        term.write(chunk);
      })
      .then((unlisten) => {
        unlistenData = unlisten;
      });

    tauriApi
      .onSshClosed(sessionId, () => {
        term.writeln('\r\n\x1b[31m[Session closed by remote host]\x1b[0m\r\n');
        useSessionStore.getState().markSessionClosed(sessionId);
      })
      .then((unlisten) => {
        unlistenClosed = unlisten;
      });

    // 4. Resize handling
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        term.focus();
      } catch (e) {
        // Suppress layout race condition warnings during unmount
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial fit after rendering
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    });

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (unlistenData) unlistenData();
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
