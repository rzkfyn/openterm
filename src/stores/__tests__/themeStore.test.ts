import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore, THEME_PRESETS } from '../themeStore';

describe('themeStore', () => {
  const storageMap = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.clear();
    useThemeStore.getState().setTheme('midnight');
  });

  it('initializes with default midnight theme', () => {
    const state = useThemeStore.getState();
    expect(state.currentThemeId).toBe('midnight');
    expect(state.theme.name).toBe('Midnight (Default)');
    expect(state.theme.xterm.background).toBe('#13131d');
  });

  it('switches to dracula theme and persists to localStorage', () => {
    useThemeStore.getState().setTheme('dracula');
    const state = useThemeStore.getState();
    expect(state.currentThemeId).toBe('dracula');
    expect(state.theme.name).toBe('Dracula');
    expect(state.theme.xterm.background).toBe('#282a36');
    expect(localStorage.getItem('openterm_terminal_theme')).toBe('dracula');
  });

  it('switches between all available presets', () => {
    for (const preset of THEME_PRESETS) {
      useThemeStore.getState().setTheme(preset.id);
      const state = useThemeStore.getState();
      expect(state.currentThemeId).toBe(preset.id);
      expect(state.theme.id).toBe(preset.id);
      expect(state.theme.xterm.foreground).toBeDefined();
    }
  });

  it('ignores invalid theme id', () => {
    useThemeStore.getState().setTheme('nonexistent');
    const state = useThemeStore.getState();
    expect(state.currentThemeId).toBe('midnight');
  });
});
