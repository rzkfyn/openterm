import { create } from 'zustand';

export interface FilePaneColumnConfig {
  sizeWidth: number;
  modifiedWidth: number;
  showSize: boolean;
  showModified: boolean;
}

export const DEFAULT_COLUMN_CONFIG: FilePaneColumnConfig = {
  sizeWidth: 64,
  modifiedWidth: 96,
  showSize: true,
  showModified: true,
};

const STORAGE_KEY = 'openterm_sftp_columns';

function loadSavedColumnConfig(): FilePaneColumnConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_COLUMN_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sizeWidth:
          typeof parsed.sizeWidth === 'number'
            ? Math.max(36, Math.min(240, parsed.sizeWidth))
            : DEFAULT_COLUMN_CONFIG.sizeWidth,
        modifiedWidth:
          typeof parsed.modifiedWidth === 'number'
            ? Math.max(50, Math.min(260, parsed.modifiedWidth))
            : DEFAULT_COLUMN_CONFIG.modifiedWidth,
        showSize: parsed.showSize !== false,
        showModified: parsed.showModified !== false,
      };
    }
  } catch {}
  return DEFAULT_COLUMN_CONFIG;
}

interface ColumnConfigState extends FilePaneColumnConfig {
  setSizeWidth: (width: number) => void;
  setModifiedWidth: (width: number) => void;
  toggleShowSize: () => void;
  toggleShowModified: () => void;
  resetColumns: () => void;
}

export const useColumnConfigStore = create<ColumnConfigState>((set, get) => {
  const initial = loadSavedColumnConfig();

  const persist = (next: FilePaneColumnConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return {
    ...initial,
    setSizeWidth: (sizeWidth) => {
      const clamped = Math.max(36, Math.min(240, Math.round(sizeWidth)));
      set({ sizeWidth: clamped });
      const current = get();
      persist({
        sizeWidth: clamped,
        modifiedWidth: current.modifiedWidth,
        showSize: current.showSize,
        showModified: current.showModified,
      });
    },
    setModifiedWidth: (modifiedWidth) => {
      const clamped = Math.max(50, Math.min(260, Math.round(modifiedWidth)));
      set({ modifiedWidth: clamped });
      const current = get();
      persist({
        sizeWidth: current.sizeWidth,
        modifiedWidth: clamped,
        showSize: current.showSize,
        showModified: current.showModified,
      });
    },
    toggleShowSize: () => {
      set((state) => {
        const next = !state.showSize;
        persist({ ...state, showSize: next });
        return { showSize: next };
      });
    },
    toggleShowModified: () => {
      set((state) => {
        const next = !state.showModified;
        persist({ ...state, showModified: next });
        return { showModified: next };
      });
    },
    resetColumns: () => {
      set({ ...DEFAULT_COLUMN_CONFIG });
      persist(DEFAULT_COLUMN_CONFIG);
    },
  };
});
