import { create } from 'zustand';

export interface XtermThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalThemePreset {
  id: string;
  name: string;
  xterm: XtermThemeColors;
}

export const THEME_PRESETS: TerminalThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight (Default)',
    xterm: {
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
  },
  {
    id: 'dracula',
    name: 'Dracula',
    xterm: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      selectionBackground: 'rgba(68, 71, 90, 0.5)',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    xterm: {
      background: '#1e222a',
      foreground: '#abb2bf',
      cursor: '#528bff',
      selectionBackground: 'rgba(62, 68, 81, 0.6)',
      black: '#282c34',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#5c6370',
      brightRed: '#be5046',
      brightGreen: '#98c379',
      brightYellow: '#d19a66',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    xterm: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      selectionBackground: 'rgba(67, 76, 94, 0.6)',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#d08770',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    xterm: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#93a1a1',
      selectionBackground: 'rgba(7, 54, 66, 0.8)',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
];

interface ThemeState {
  currentThemeId: string;
  theme: TerminalThemePreset;
  setTheme: (id: string) => void;
}

const STORAGE_KEY = 'openterm_terminal_theme';

export const useThemeStore = create<ThemeState>((set) => {
  const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const initialTheme = THEME_PRESETS.find((t) => t.id === savedId) || THEME_PRESETS[0];

  return {
    currentThemeId: initialTheme.id,
    theme: initialTheme,
    setTheme: (id: string) => {
      const found = THEME_PRESETS.find((t) => t.id === id);
      if (found) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, id);
        }
        set({ currentThemeId: found.id, theme: found });
      }
    },
  };
});
