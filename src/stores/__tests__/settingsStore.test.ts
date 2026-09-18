import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, DEFAULT_SETTINGS, loadSavedSettings } from '../settingsStore';

describe('settingsStore', () => {
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
    useSettingsStore.getState().resetSettings();
    useSettingsStore.getState().closeSettings();
  });

  it('initializes with default settings', () => {
    const { settings, isOpen } = useSettingsStore.getState();
    expect(settings.fontSize).toBe(13);
    expect(settings.cursorStyle).toBe('block');
    expect(settings.cursorBlink).toBe(true);
    expect(isOpen).toBe(false);
  });

  it('updates a specific setting and persists to localStorage', () => {
    useSettingsStore.getState().updateSetting('fontSize', 16);
    useSettingsStore.getState().updateSetting('fontFamily', "'Fira Code', monospace");
    useSettingsStore.getState().updateSetting('cursorStyle', 'bar');

    const state = useSettingsStore.getState();
    expect(state.settings.fontSize).toBe(16);
    expect(state.settings.fontFamily).toBe("'Fira Code', monospace");
    expect(state.settings.cursorStyle).toBe('bar');

    const raw = localStorage.getItem('openterm_app_settings');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.fontSize).toBe(16);
    expect(parsed.fontFamily).toBe("'Fira Code', monospace");
  });

  it('controls modal open and close state with tab selection', () => {
    useSettingsStore.getState().openSettings('terminal');
    expect(useSettingsStore.getState().isOpen).toBe(true);
    expect(useSettingsStore.getState().activeTab).toBe('terminal');

    useSettingsStore.getState().closeSettings();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it('resets settings back to defaults', () => {
    useSettingsStore.getState().updateSetting('fontSize', 20);
    useSettingsStore.getState().resetSettings();

    expect(useSettingsStore.getState().settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('handles terminal font size increment, decrement, and reset shortcuts', () => {
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().settings.fontSize).toBe(13);

    useSettingsStore.getState().increaseTerminalFontSize();
    expect(useSettingsStore.getState().settings.fontSize).toBe(14);

    useSettingsStore.getState().decreaseTerminalFontSize();
    expect(useSettingsStore.getState().settings.fontSize).toBe(13);

    useSettingsStore.getState().updateSetting('fontSize', 22);
    useSettingsStore.getState().resetTerminalFontSize();
    expect(useSettingsStore.getState().settings.fontSize).toBe(13);
  });

  it('updates appFontFamily and sets CSS variable on document element', () => {
    const setPropertyMock = vi.fn();
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: setPropertyMock,
        },
      },
    });

    useSettingsStore.getState().updateSetting('appFontFamily', '"Geist", sans-serif');
    expect(useSettingsStore.getState().settings.appFontFamily).toBe('"Geist", sans-serif');
    expect(setPropertyMock).toHaveBeenCalledWith('--app-font-family', '"Geist", sans-serif');
  });

  it('initializes split sync settings with correct defaults', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.sftpSyncToTerminal).toBe(true);
    expect(settings.sftpSyncFromTerminal).toBe(false);
  });

  it('allows independent updating of sftpSyncToTerminal and sftpSyncFromTerminal', () => {
    useSettingsStore.getState().updateSetting('sftpSyncToTerminal', false);
    useSettingsStore.getState().updateSetting('sftpSyncFromTerminal', true);

    const { settings } = useSettingsStore.getState();
    expect(settings.sftpSyncToTerminal).toBe(false);
    expect(settings.sftpSyncFromTerminal).toBe(true);
  });

  it('migrates legacy openterm_sftp_auto_sync to sftpSyncToTerminal in loadSavedSettings', () => {
    localStorage.setItem('openterm_sftp_auto_sync', 'false');
    const settingsFalse = loadSavedSettings();
    expect(settingsFalse.sftpSyncToTerminal).toBe(false);

    localStorage.setItem('openterm_sftp_auto_sync', 'true');
    const settingsTrue = loadSavedSettings();
    expect(settingsTrue.sftpSyncToTerminal).toBe(true);
  });

  it('migrates legacy sftpAutoSync in stored settings to sftpSyncToTerminal', () => {
    localStorage.setItem('openterm_app_settings', JSON.stringify({ sftpAutoSync: false }));
    const settings = loadSavedSettings();
    expect(settings.sftpSyncToTerminal).toBe(false);
    expect(settings.sftpSyncFromTerminal).toBe(false);
  });

  it('prioritizes sftpSyncToTerminal over legacy settings when present', () => {
    localStorage.setItem('openterm_sftp_auto_sync', 'false');
    localStorage.setItem(
      'openterm_app_settings',
      JSON.stringify({ sftpAutoSync: false, sftpSyncToTerminal: true })
    );
    const settings = loadSavedSettings();
    expect(settings.sftpSyncToTerminal).toBe(true);
  });
});
