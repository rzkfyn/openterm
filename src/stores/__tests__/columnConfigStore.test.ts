import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useColumnConfigStore, DEFAULT_COLUMN_CONFIG } from '../columnConfigStore';

describe('useColumnConfigStore', () => {
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
    useColumnConfigStore.getState().resetColumns();
  });
  it('initializes with default column configuration', () => {
    const state = useColumnConfigStore.getState();
    expect(state.sizeWidth).toBe(DEFAULT_COLUMN_CONFIG.sizeWidth);
    expect(state.modifiedWidth).toBe(DEFAULT_COLUMN_CONFIG.modifiedWidth);
    expect(state.showSize).toBe(true);
    expect(state.showModified).toBe(true);
  });

  it('updates and clamps sizeWidth within bounds', () => {
    useColumnConfigStore.getState().setSizeWidth(120);
    expect(useColumnConfigStore.getState().sizeWidth).toBe(120);

    // Below minimum constraint (36)
    useColumnConfigStore.getState().setSizeWidth(10);
    expect(useColumnConfigStore.getState().sizeWidth).toBe(36);

    // Above maximum constraint (240)
    useColumnConfigStore.getState().setSizeWidth(300);
    expect(useColumnConfigStore.getState().sizeWidth).toBe(240);
  });

  it('updates and clamps modifiedWidth within bounds', () => {
    useColumnConfigStore.getState().setModifiedWidth(150);
    expect(useColumnConfigStore.getState().modifiedWidth).toBe(150);

    // Below minimum constraint (50)
    useColumnConfigStore.getState().setModifiedWidth(20);
    expect(useColumnConfigStore.getState().modifiedWidth).toBe(50);

    // Above maximum constraint (260)
    useColumnConfigStore.getState().setModifiedWidth(400);
    expect(useColumnConfigStore.getState().modifiedWidth).toBe(260);
  });

  it('toggles column visibility and resets to default', () => {
    useColumnConfigStore.getState().toggleShowSize();
    expect(useColumnConfigStore.getState().showSize).toBe(false);

    useColumnConfigStore.getState().toggleShowModified();
    expect(useColumnConfigStore.getState().showModified).toBe(false);

    useColumnConfigStore.getState().resetColumns();
    expect(useColumnConfigStore.getState().showSize).toBe(true);
    expect(useColumnConfigStore.getState().showModified).toBe(true);
    expect(useColumnConfigStore.getState().sizeWidth).toBe(DEFAULT_COLUMN_CONFIG.sizeWidth);
  });
});
