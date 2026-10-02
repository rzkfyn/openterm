import React, { useEffect, useRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, StreamLanguage } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

// Language support loaders
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { yaml } from '@codemirror/lang-yaml';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';

// StreamLanguage legacy modes for shell, configs, scripts
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { xml } from '@codemirror/legacy-modes/mode/xml';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { go } from '@codemirror/legacy-modes/mode/go';
interface CodeMirrorEditorProps {
  value: string;
  filePath: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export function getLanguageExtension(filePath: string, content?: string): Extension | null {
  const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() || '';
  const ext = filename.split('.').pop() || '';

  // Exact or prefix filename matches
  if (filename === 'dockerfile' || filename.startsWith('dockerfile.')) return StreamLanguage.define(dockerFile);
  if (filename === 'nginx.conf') return StreamLanguage.define(nginx);
  if (filename === 'cargo.lock') return StreamLanguage.define(toml);
  if (
    ['.bashrc', '.zshrc', '.profile', '.bash_profile', '.bash_logout'].includes(filename) ||
    filename.startsWith('.env')
  ) {
    return StreamLanguage.define(shell);
  }

  // Extension matches
  switch (ext) {
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'ksh':
    case 'csh':
    case 'env':
      return StreamLanguage.define(shell);
    case 'dockerfile':
      return StreamLanguage.define(dockerFile);
    case 'toml':
      return StreamLanguage.define(toml);
    case 'nginx':
      return StreamLanguage.define(nginx);
    case 'ini':
    case 'properties':
    case 'conf':
    case 'cfg':
    case 'cnf':
    case 'service':
      return StreamLanguage.define(properties);
    case 'xml':
    case 'svg':
      return StreamLanguage.define(xml);
    case 'ps1':
    case 'psm1':
    case 'psd1':
      return StreamLanguage.define(powerShell);
    case 'lua':
      return StreamLanguage.define(lua);
    case 'go':
      return StreamLanguage.define(go);
    case 'json':
    case 'jsonc':
    case 'json5':
      return json();
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript();
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true });
    case 'py':
    case 'pyw':
    case 'wsgi':
      return python();
    case 'html':
    case 'htm':
    case 'xhtml':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'rs':
      return rust();
    case 'sql':
      return sql();
    case 'md':
    case 'markdown':
      return markdown();
  }

  // Content shebang fallback
  if (content && content.startsWith('#!')) {
    const firstLine = content.slice(0, 100).toLowerCase();
    if (firstLine.includes('bash') || firstLine.includes('sh') || firstLine.includes('zsh')) {
      return StreamLanguage.define(shell);
    }
    if (firstLine.includes('python')) {
      return python();
    }
    if (firstLine.includes('node')) {
      return javascript();
    }
  }

  return null;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  filePath,
  onChange,
  onSave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(filePath, value);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      foldGutter(),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: 'Mod-s',
          run: () => {
            if (onSaveRef.current) {
              onSaveRef.current();
              return true;
            }
            return false;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '12px',
          fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          backgroundColor: '#15151e',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-gutters': {
          backgroundColor: '#11111a',
          color: '#64748b',
          borderRight: '1px solid #2a2b38',
        },
        '.cm-activeLine': {
          backgroundColor: '#1e1e2d80',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#1e1e2d',
          color: '#cbd5e1',
        },
      }),
    ];

    if (langExt) {
      extensions.push(langExt);
    }

    const startState = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [filePath]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
};
