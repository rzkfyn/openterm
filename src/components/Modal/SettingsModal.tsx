import React, { useState } from 'react';
import {
  X,
  Palette,
  Type,
  Terminal,
  FolderTree,
  Shield,
  Info,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  Plus,
  Minus,
  HelpCircle,
} from 'lucide-react';
import { useSettingsStore, FONT_PRESETS, APP_FONT_PRESETS, SettingsTab } from '../../stores/settingsStore';
import { Osc7SetupModal } from './Osc7SetupModal';
import { useThemeStore, THEME_PRESETS } from '../../stores/themeStore';
import { useUpdateStore } from '../../stores/updateStore';
import { useSavedConnectionStore } from '../../stores/savedConnectionStore';
import { useTotpStore } from '../../stores/totpStore';
import { useBiometricStore } from '../../stores/biometricStore';
import { getBiometricName } from '../../utils/platform';
import { APP_VERSION } from '../../version';
import { tauriApi } from '../../services/tauri';

interface SettingsModalProps {
  onOpenVaultModal?: () => void;
  onOpenTotpModal?: () => void;
}

const REPO_URL = 'https://github.com/rzkfyn/openterm';
const RELEASES_URL = 'https://github.com/rzkfyn/openterm/releases';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onOpenVaultModal,
  onOpenTotpModal,
}) => {
  const {
    isOpen,
    activeTab,
    openSettings,
    closeSettings,
    settings,
    updateSetting,
    resetSettings,
  } = useSettingsStore();

  const { currentThemeId, setTheme } = useThemeStore();
  const { isChecking, checkForUpdates, currentVersion } = useUpdateStore();
  const { vaultStatus } = useSavedConnectionStore();
  const totpConfig = useTotpStore((s) => s.config);
  const { isEnabled: isBiometricEnabled, isAvailable: isBiometricAvailable } = useBiometricStore();

  const [isCustomFont, setIsCustomFont] = useState(() => {
    return !FONT_PRESETS.some((p) => p.value === settings.fontFamily);
  });
  const [customFontInput, setCustomFontInput] = useState(settings.fontFamily);

  const [isCustomAppFont, setIsCustomAppFont] = useState(() => {
    return !APP_FONT_PRESETS.some((p) => p.value === settings.appFontFamily);
  });
  const [customAppFontInput, setCustomAppFontInput] = useState(settings.appFontFamily);
  const [isOsc7ModalOpen, setIsOsc7ModalOpen] = useState(false);
  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'sftp', label: 'SFTP Explorer', icon: FolderTree },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'about', label: 'About', icon: Info },
  ];

  const handleOpenUrl = (url: string) => {
    tauriApi.openUrl(url).catch(() => {
      window.open(url, '_blank');
    });
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 p-4 select-none">
      <div className="flex flex-col w-full max-w-2xl h-[560px] rounded-xl bg-[#181824] border border-[#2a2b38] shadow-2xl text-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2b38] bg-[#141420]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e1e2d] border border-[#2a2b38] text-indigo-400 shrink-0">
              <Type className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Settings</h2>
              <p className="text-[11px] text-slate-400">Configure appearance, terminal fonts, and workspace preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body: Sidebar Navigation + Content Panel */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Tab Navigation */}
          <div className="w-44 border-r border-[#2a2b38] bg-[#13131e] p-2 space-y-0.5 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openSettings(tab.id)}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#1e1e2d] text-white font-semibold shadow-xs border border-[#2a2b38]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#181824] border border-transparent'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-[#262738] px-2">
              <button
                type="button"
                onClick={resetSettings}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-300 transition-colors cursor-pointer"
                title="Reset all settings to default values"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>
          </div>

          {/* Right: Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 text-xs space-y-5">
            {/* TAB: APPEARANCE & TYPOGRAPHY */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Application & Terminal Theme
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Applies full color palette across the application chrome and terminal session.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected = currentThemeId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setTheme(preset.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#1e1e2d] border-indigo-500 text-white shadow-xs'
                              : 'bg-[#11111a] border-[#2a2b38] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-xs truncate">{preset.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {preset.xterm.background}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <span
                              className="h-3 w-3 rounded-full border border-white/10"
                              style={{ backgroundColor: preset.xterm.background }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-white/10"
                              style={{ backgroundColor: preset.xterm.blue }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Family */}
                <div className="pt-3 border-t border-[#262738]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-200">
                      Terminal Font Family
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomFont(!isCustomFont)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      {isCustomFont ? 'Choose from Presets' : 'Enter Custom Font'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Select a monospace typeface installed on your system.
                  </p>

                  {isCustomFont ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customFontInput}
                        onChange={(e) => {
                          setCustomFontInput(e.target.value);
                          updateSetting('fontFamily', e.target.value);
                        }}
                        placeholder="e.g. 'JetBrains Mono', 'Fira Code', monospace"
                        className="flex-1 rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-3 py-1.5 text-xs text-slate-100 outline-none font-mono"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={settings.fontFamily}
                        onChange={(e) => {
                          updateSetting('fontFamily', e.target.value);
                          setCustomFontInput(e.target.value);
                        }}
                        className="w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 pl-3 pr-8 py-1.5 text-xs text-slate-100 outline-none transition-colors appearance-none cursor-pointer"
                      >
                        {FONT_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.value} className="bg-[#181824] text-slate-200">
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Font Size & Line Height */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#262738]">
                  {/* Font Size Stepper */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-200">
                        Font Size ({settings.fontSize}px)
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono" title="Zoom in/out with keyboard in terminal">
                        Cmd/Ctrl + / -
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateSetting('fontSize', Math.max(10, settings.fontSize - 1))}
                        disabled={settings.fontSize <= 10}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#11111a] border border-[#2a2b38] text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 cursor-pointer transition-colors"
                        title="Decrease font size"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="range"
                        min={10}
                        max={24}
                        step={1}
                        value={settings.fontSize}
                        onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-[#11111a] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => updateSetting('fontSize', Math.min(24, settings.fontSize + 1))}
                        disabled={settings.fontSize >= 24}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#11111a] border border-[#2a2b38] text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 cursor-pointer transition-colors"
                        title="Increase font size"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Line Height */}
                  <div>
                    <label className="block text-xs font-medium text-slate-200 mb-1">
                      Line Height
                    </label>
                    <div className="relative">
                      <select
                        value={settings.lineHeight}
                        onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                        className="w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 pl-3 pr-8 py-1.5 text-xs text-slate-100 outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value={1.0} className="bg-[#181824] text-slate-200">1.0 (Dense)</option>
                        <option value={1.15} className="bg-[#181824] text-slate-200">1.15 (Compact)</option>
                        <option value={1.25} className="bg-[#181824] text-slate-200">1.25 (Default)</option>
                        <option value={1.4} className="bg-[#181824] text-slate-200">1.4 (Spacious)</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Live Terminal Preview */}
                <div className="pt-3 border-t border-[#262738]">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                    Live Terminal Font Preview
                  </label>
                  <div
                    className="p-3 rounded-lg border border-[#2a2b38] font-mono select-none overflow-hidden"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: settings.lineHeight,
                    }}
                  >
                    <div className="text-emerald-400">user@openterm:~$ git status</div>
                    <div className="text-slate-300 mt-1">On branch main (up to date with origin/main)</div>
                    <div className="text-slate-400">SSH2 / AES-256 / Dual SFTP ready.</div>
                  </div>
                </div>

                {/* Application UI Typography */}
                <div className="pt-3 border-t border-[#262738]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-200">
                      Application Interface Font
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomAppFont(!isCustomAppFont)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      {isCustomAppFont ? 'Choose from Presets' : 'Enter Custom Font'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Controls typography across the navigation, sidebar, dashboard, explorer, and modal interfaces.
                  </p>

                  {isCustomAppFont ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAppFontInput}
                        onChange={(e) => {
                          setCustomAppFontInput(e.target.value);
                          updateSetting('appFontFamily', e.target.value);
                        }}
                        placeholder="e.g. 'Geist', 'Inter', sans-serif"
                        className="flex-1 rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 px-3 py-1.5 text-xs text-slate-100 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={settings.appFontFamily}
                        onChange={(e) => {
                          updateSetting('appFontFamily', e.target.value);
                          setCustomAppFontInput(e.target.value);
                        }}
                        className="w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 pl-3 pr-8 py-1.5 text-xs text-slate-100 outline-none transition-colors appearance-none cursor-pointer"
                      >
                        {APP_FONT_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.value} className="bg-[#181824] text-slate-200">
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: TERMINAL BEHAVIOR */}
            {activeTab === 'terminal' && (
              <div className="space-y-4">
                {/* Cursor Style */}
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Cursor Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'block', label: 'Block ( █ )' },
                      { id: 'underline', label: 'Underline ( _ )' },
                      { id: 'bar', label: 'Bar ( │ )' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => updateSetting('cursorStyle', style.id as any)}
                        className={`py-2 px-3 rounded-md border text-center font-mono text-xs cursor-pointer transition-colors ${
                          settings.cursorStyle === style.id
                            ? 'bg-[#1e1e2d] border-indigo-500 text-white font-semibold'
                            : 'bg-[#11111a] border-[#2a2b38] text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cursor Blink */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Cursor Blinking</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Animate cursor pulse in active terminal</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.cursorBlink}
                      onChange={(e) => updateSetting('cursorBlink', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Scrollback Buffer */}
                <div className="pt-3 border-t border-[#262738]">
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Scrollback Buffer Lines
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Maximum lines of terminal history kept in memory per session.
                  </p>
                  <div className="relative w-48">
                    <select
                      value={settings.scrollback}
                      onChange={(e) => updateSetting('scrollback', Number(e.target.value))}
                      className="w-full rounded-md bg-[#11111a] border border-[#2a2b38] focus:border-indigo-500/80 pl-3 pr-8 py-1.5 text-xs text-slate-100 outline-none transition-colors appearance-none cursor-pointer"
                    >
                      <option value={1000} className="bg-[#181824] text-slate-200">1,000 lines</option>
                      <option value={5000} className="bg-[#181824] text-slate-200">5,000 lines (Default)</option>
                      <option value={10000} className="bg-[#181824] text-slate-200">10,000 lines</option>
                      <option value={20000} className="bg-[#181824] text-slate-200">20,000 lines</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Copy on Select */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Copy on Select</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Automatically copy highlighted text to clipboard</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.copyOnSelect}
                      onChange={(e) => updateSetting('copyOnSelect', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Confirm Close Session */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Confirm on Close Tab</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ask confirmation before terminating active SSH session</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.confirmCloseSession}
                      onChange={(e) => updateSetting('confirmCloseSession', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: SFTP EXPLORER */}
            {activeTab === 'sftp' && (
              <div className="space-y-4">
                {/* Default Session View Mode */}
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Default Session View
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Layout to open automatically when connecting to an SSH profile.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'terminal', label: 'Terminal Only' },
                      { id: 'split', label: 'Split (Terminal + SFTP)' },
                      { id: 'sftp', label: 'SFTP Only' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateSetting('defaultViewMode', mode.id as any)}
                        className={`py-2 px-3 rounded-md border text-center text-xs font-medium cursor-pointer transition-colors ${
                          settings.defaultViewMode === mode.id
                            ? 'bg-[#1e1e2d] border-indigo-500 text-white font-semibold'
                            : 'bg-[#11111a] border-[#2a2b38] text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Hidden Files */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Show Hidden Files (Dotfiles)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Display files and directories starting with a dot</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sftpShowHiddenFiles}
                      onChange={(e) => updateSetting('sftpShowHiddenFiles', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Row 1: SFTP to Terminal Navigation (Auto-CD) */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Sync SFTP to Terminal</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Send cd command to active terminal when navigating remote folders
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sftpSyncToTerminal}
                      onChange={(e) => updateSetting('sftpSyncToTerminal', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Row 2: Terminal to SFTP Navigation (Auto-Follow) */}
                <div className="flex items-center justify-between pt-3 border-t border-[#262738]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-200">Sync Terminal to SFTP</span>
                      <button
                        type="button"
                        onClick={() => setIsOsc7ModalOpen(true)}
                        title="View remote shell setup guide"
                        className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Follow terminal working directory via OSC 7 escape sequences
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sftpSyncFromTerminal}
                      onChange={(e) => updateSetting('sftpSyncFromTerminal', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#11111a] border border-[#2a2b38] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: SECURITY & VAULT */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <p className="text-slate-300 text-xs leading-relaxed">
                  Manage app lock, hardware passkeys, and AES-256 disk encryption protecting your saved credentials.
                </p>

                <div className="rounded-lg bg-[#11111a] border border-[#2a2b38] divide-y divide-[#262738] overflow-hidden">
                  {/* Master Password Vault */}
                  <div className="flex items-center justify-between p-3.5 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">Master Password Vault</span>
                        {vaultStatus.isEncrypted ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {vaultStatus.isUnlocked ? 'Unlocked' : 'Locked'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Unencrypted</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        AES-256-GCM encryption with PBKDF2 key derivation for saved passwords
                      </p>
                    </div>
                    {onOpenVaultModal && (
                      <button
                        type="button"
                        onClick={() => {
                          closeSettings();
                          onOpenVaultModal();
                        }}
                        className="px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-500 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Manage Vault
                      </button>
                    )}
                  </div>

                  {/* Touch ID / Passkey */}
                  <div className="flex items-center justify-between p-3.5 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{getBiometricName()} / Passkey</span>
                        {isBiometricEnabled ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {isBiometricAvailable ? 'Disabled' : 'Not Configured'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hardware-backed biometric authentication
                      </p>
                    </div>
                  </div>

                  {/* 2FA App Lock */}
                  <div className="flex items-center justify-between p-3.5 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">Two-Factor Authentication</span>
                        {totpConfig.enabled ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Disabled</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Time-based one-time password (TOTP) app lock
                      </p>
                    </div>
                    {onOpenTotpModal && (
                      <button
                        type="button"
                        onClick={() => {
                          closeSettings();
                          onOpenTotpModal();
                        }}
                        className="px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-500 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Configure 2FA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 p-4 rounded-lg bg-[#11111a] border border-[#2a2b38]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e1e2d] border border-[#2a2b38] p-2 shrink-0">
                    <img src="/app-icon.png" alt="OpenTerm" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">OpenTerm</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2d] text-slate-400 border border-[#2a2b38]">
                        v{currentVersion || APP_VERSION}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Lightweight, Secure Dual SSH & SFTP Client for Modern Developers
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-[#11111a] border border-[#2a2b38] divide-y divide-[#262738]">
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-medium text-slate-200">Software Updates</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Check for newer GitHub releases</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => checkForUpdates(true)}
                      disabled={isChecking}
                      className="px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-500 text-slate-200 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isChecking ? 'Checking...' : 'Check for Updates'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-medium text-slate-200">Release Notes</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">View changelog and release history</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenUrl(RELEASES_URL)}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      <span>Releases</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-medium text-slate-200">GitHub Repository</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Open source project repository</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenUrl(REPO_URL)}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      <span>rzkfyn/openterm</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      <Osc7SetupModal isOpen={isOsc7ModalOpen} onClose={() => setIsOsc7ModalOpen(false)} />
    </>
  );
};
