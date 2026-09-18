import { create } from 'zustand';

export type CursorStyle = 'block' | 'underline' | 'bar';
export type DefaultViewMode = 'terminal' | 'split' | 'sftp';
export type SettingsTab = 'appearance' | 'terminal' | 'sftp' | 'security' | 'about';

export interface AppSettings {
  // App UI Typography
  appFontFamily: string;
  // Terminal Typography
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  // Terminal Behavior
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  confirmCloseSession: boolean;
  // SFTP Explorer
  sftpShowHiddenFiles: boolean;
  sftpSyncToTerminal: boolean;
  sftpSyncFromTerminal: boolean;
  defaultViewMode: DefaultViewMode;
}

export const APP_FONT_PRESETS = [
  {
    id: 'system',
    name: 'System Default',
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'geist',
    name: 'Geist Sans',
    value: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'inter',
    name: 'Inter',
    value: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'segoe',
    name: 'Segoe UI',
    value: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    value: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    value: '"Ubuntu", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
];

export const FONT_PRESETS = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { id: 'fira-code', name: 'Fira Code', value: "'Fira Code', monospace" },
  { id: 'cascadia-code', name: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { id: 'sf-mono', name: 'SF Mono', value: "'SF Mono', monospace" },
  { id: 'menlo', name: 'Menlo', value: "Menlo, monospace" },
  { id: 'monaco', name: 'Monaco', value: "Monaco, monospace" },
  { id: 'consolas', name: 'Consolas', value: "Consolas, monospace" },
  { id: 'source-code-pro', name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  { id: 'system-mono', name: 'System Monospace', value: 'monospace' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  appFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 13,
  fontFamily: "'JetBrains Mono', Menlo, Monaco, 'Cascadia Code', Consolas, monospace",
  lineHeight: 1.25,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  copyOnSelect: false,
  confirmCloseSession: true,
  sftpShowHiddenFiles: true,
  sftpSyncToTerminal: true,
  sftpSyncFromTerminal: false,
  defaultViewMode: 'terminal',
};

const STORAGE_KEY = 'openterm_app_settings';

export function applyAppFontToDOM(fontFamily: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
  }
}

interface SettingsState {
  settings: AppSettings;
  isOpen: boolean;
  activeTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  increaseTerminalFontSize: () => void;
  decreaseTerminalFontSize: () => void;
  resetTerminalFontSize: () => void;
  resetSettings: () => void;
}

export function loadSavedSettings(): AppSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    if (parsed.sftpAutoSync !== undefined && parsed.sftpSyncToTerminal === undefined) {
      parsed.sftpSyncToTerminal = parsed.sftpAutoSync;
    }

    if (parsed.sftpSyncToTerminal === undefined) {
      const legacy = localStorage.getItem('openterm_sftp_auto_sync');
      if (legacy !== null) {
        parsed.sftpSyncToTerminal = legacy !== 'false';
      }
    }

    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {}
  return DEFAULT_SETTINGS;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initialSettings = loadSavedSettings();
  applyAppFontToDOM(initialSettings.appFontFamily);

  return {
    settings: initialSettings,
    isOpen: false,
    activeTab: 'appearance',

    openSettings: (tab = 'appearance') => {
      set({ isOpen: true, activeTab: tab });
    },

    closeSettings: () => {
      set({ isOpen: false });
    },

    updateSetting: (key, value) => {
      const updated = { ...get().settings, [key]: value };
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      if (key === 'appFontFamily') {
        applyAppFontToDOM(value as string);
      }
      set({ settings: updated });
    },

    increaseTerminalFontSize: () => {
      const cur = get().settings.fontSize;
      if (cur < 28) {
        get().updateSetting('fontSize', cur + 1);
      }
    },

    decreaseTerminalFontSize: () => {
      const cur = get().settings.fontSize;
      if (cur > 9) {
        get().updateSetting('fontSize', cur - 1);
      }
    },

    resetTerminalFontSize: () => {
      get().updateSetting('fontSize', DEFAULT_SETTINGS.fontSize);
    },

    resetSettings: () => {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
      applyAppFontToDOM(DEFAULT_SETTINGS.appFontFamily);
      set({ settings: DEFAULT_SETTINGS });
    },
  };
});
