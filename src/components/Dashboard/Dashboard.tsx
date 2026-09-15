import React, { useEffect, useState } from 'react';
import { useSavedConnectionStore } from '../../stores/savedConnectionStore';
import { SavedConnection } from '../../types';
import {
  Plus,
  Server,
  Pencil,
  Copy,
  Trash2,
  ArrowRight,
  Search,
  Key,
  Lock,
  Shield,
  Unlock,
  Smartphone,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Folder,
  Bookmark,
  ShieldAlert,
  X,
  KeyRound,
  Fingerprint,
  Settings,
} from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { VaultModal } from '../Modal/VaultModal';
import { ImportExportModal } from '../Modal/ImportExportModal';
import { useTotpStore } from '../../stores/totpStore';
import { useBiometricStore } from '../../stores/biometricStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getBiometricName } from '../../utils/platform';

interface DashboardProps {
  onNewConnection: () => void;
  onConnect: (conn: SavedConnection) => void;
  onEdit: (conn: SavedConnection) => void;
  onLockApp?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNewConnection,
  onConnect,
  onEdit,
}) => {
  const {
    connections,
    isLoading,
    vaultStatus,
    checkVaultStatus,
    load,
    save,
    remove,
    duplicate,
    lockVault,
  } = useSavedConnectionStore();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isVaultBannerDismissed, setIsVaultBannerDismissed] = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('openterm_vault_banner_dismissed') === 'true'
      : false
  );
  const {
    isAvailable: isBiometricAvailable,
    isEnabled: isBiometricEnabled,
    setEnabled: setBiometricEnabled,
    authenticate: authenticateBiometric,
  } = useBiometricStore();
  const isConnecting = useSessionStore((state) => state.isConnecting);

  const handleTogglePasskey = async () => {
    const bioName = getBiometricName();
    if (!isBiometricAvailable && !isBiometricEnabled) {
      alert(`Biometric authentication not configured. Set up ${bioName} in System Settings.`);
      return;
    }
    try {
      if (!isBiometricEnabled) {
        const verified = await authenticateBiometric(`Enable ${bioName} / Passkey for OpenTerm`);
        if (verified) {
          setBiometricEnabled(true);
        }
      } else {
        const verified = await authenticateBiometric('Verify identity to disable Passkey');
        if (verified) {
          setBiometricEnabled(false);
        }
      }
    } catch {}
  };
  const [isRecoveryBannerDismissed, setIsRecoveryBannerDismissed] = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('openterm_recovery_banner_dismissed') === 'true'
      : false
  );
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const {
    config: totpConfig,
    loadConfig: loadTotp,
    openModal: openTotpModal,
  } = useTotpStore();

  useEffect(() => {
    loadTotp();
    checkVaultStatus().then((status) => {
      if (status.isUnlocked) {
        load();
      }
    });
  }, [loadTotp, checkVaultStatus, load]);

  const availableFolders = React.useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => {
      if (c.folder?.trim()) set.add(c.folder.trim());
    });
    return Array.from(set).sort();
  }, [connections]);

  const filtered = connections.filter((c) => {
    const matchesSearch = search
      ? c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.host.toLowerCase().includes(search.toLowerCase()) ||
        c.username.toLowerCase().includes(search.toLowerCase()) ||
        (c.folder && c.folder.toLowerCase().includes(search.toLowerCase()))
      : true;

    const matchesFolder =
      selectedFolder === 'All'
        ? true
        : selectedFolder === 'Uncategorized'
        ? !c.folder || !c.folder.trim()
        : c.folder === selectedFolder;

    return matchesSearch && matchesFolder;
  });

  const groupedConnections = React.useMemo(() => {
    const groups: Record<string, SavedConnection[]> = {};
    for (const c of filtered) {
      const f = c.folder?.trim() || 'Uncategorized';
      if (!groups[f]) groups[f] = [];
      groups[f].push(c);
    }
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
    return keys.map((key) => ({ folder: key, items: groups[key] }));
  }, [filtered]);

  const toggleFolderCollapse = (folder: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }));
  };

  const formatDate = (ms: number) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex h-full w-full bg-[#11111a] text-slate-200 overflow-y-auto select-none">
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto px-6 sm:px-8 py-8">
        {/* Top Header / Welcome */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#2a2b38]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e1e2d] border border-[#2a2b38] p-1.5 shrink-0">
              <img src="/app-icon.png" alt="OpenTerm" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">OpenTerm</h1>
              <p className="text-xs text-slate-400">
                SSH Terminal & Dual SFTP Explorer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Security Controls Segmented Group */}
            <div className="inline-flex items-center rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-xs overflow-hidden select-none">
              <button
                type="button"
                onClick={handleTogglePasskey}
                className="group flex items-center gap-1.5 px-3 py-1.5 border-r border-[#2a2b38] text-slate-300 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer whitespace-nowrap"
                title={
                  isBiometricEnabled
                    ? `${getBiometricName()} / Passkey is active (Click to disable)`
                    : isBiometricAvailable
                    ? `Enable ${getBiometricName()} / Passkey`
                    : `Passkey not configured in OS (${getBiometricName()})`
                }
              >
                <Fingerprint className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                  isBiometricEnabled ? 'text-slate-300 group-hover:text-emerald-400' : 'text-slate-500'
                }`} />
                <span className="font-medium">Passkey</span>
                {isBiometricEnabled ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Active" />
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
              </button>

              <button
                type="button"
                onClick={openTotpModal}
                className="group flex items-center gap-1.5 px-3 py-1.5 border-r border-[#2a2b38] text-slate-300 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer whitespace-nowrap"
                title={totpConfig.enabled ? '2FA App Lock is active (Click to manage)' : 'Enable 2FA App Lock'}
              >
                <Smartphone className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                  totpConfig.enabled ? 'text-slate-300 group-hover:text-indigo-400' : 'text-slate-500'
                }`} />
                <span className="font-medium">2FA</span>
                {totpConfig.enabled ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Active" />
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsVaultModalOpen(true)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white hover:bg-[#252538] transition-colors cursor-pointer whitespace-nowrap ${
                  vaultStatus.isEncrypted && vaultStatus.isUnlocked ? 'border-r border-[#2a2b38]' : ''
                }`}
                title={
                  vaultStatus.isEncrypted
                    ? vaultStatus.isUnlocked
                      ? 'Master Password Vault is Unlocked (AES-256). Click to manage.'
                      : 'Master Password Vault is Locked. Click to unlock.'
                    : 'Enable Master Password Vault (Disk Encryption)'
                }
              >
                <Shield
                  className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                    vaultStatus.isEncrypted && vaultStatus.isUnlocked
                      ? 'text-slate-300 group-hover:text-emerald-400'
                      : vaultStatus.isEncrypted
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                />
                <span className="font-medium">Vault</span>
                {vaultStatus.isEncrypted ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      vaultStatus.isUnlocked ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    title={vaultStatus.isUnlocked ? 'Unlocked' : 'Locked'}
                  />
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Off</span>
                )}
              </button>

              {vaultStatus.isEncrypted && vaultStatus.isUnlocked && (
                <button
                  type="button"
                  onClick={lockVault}
                  className="group flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-amber-300 hover:bg-[#252538] transition-colors cursor-pointer whitespace-nowrap"
                  title="Lock Vault now"
                >
                  <Lock className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-amber-400 transition-colors" />
                  <span className="text-[11px] font-medium">Lock</span>
                </button>
              )}
            </div>

            <div className="h-5 w-px bg-[#2a2b38] mx-0.5 hidden lg:block" />

            {/* Settings */}
            <button
              type="button"
              onClick={() => useSettingsStore.getState().openSettings()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
              title="Preferences & Typography Settings (Cmd+,)"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Settings</span>
            </button>

            {/* Utility & Primary Actions */}
            <button
              type="button"
              onClick={() => {
                if (vaultStatus.isEncrypted && !vaultStatus.isUnlocked) {
                  setIsVaultModalOpen(true);
                  return;
                }
                setIsImportExportOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
              title={
                vaultStatus.isEncrypted && !vaultStatus.isUnlocked
                  ? 'Unlock Vault to Import / Export'
                  : 'Import or Export connections'
              }
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <span>Import / Export</span>
            </button>

            <button
              type="button"
              onClick={onNewConnection}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>New Connection</span>
            </button>
          </div>
        </div>

        {/* Vault Encryption Reminder Banner */}
        {!vaultStatus.isEncrypted && !isVaultBannerDismissed && connections.some((c) => Boolean(c.password || c.passphrase)) && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-amber-200">
                  Protect Saved Passwords with Disk Encryption
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You have saved SSH credentials. Set an AES-256 Master Password to encrypt connection profiles at rest.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(true)}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-medium cursor-pointer transition-colors"
              >
                Set Master Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVaultBannerDismissed(true);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('openterm_vault_banner_dismissed', 'true');
                  }
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 cursor-pointer transition-colors"
                title="Dismiss reminder"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Biometric Emergency Recovery Reminder Banner */}
        {isBiometricEnabled && !totpConfig.hasBackupCodes && !isRecoveryBannerDismissed && (
          <div className="mb-4 p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/40 flex items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-indigo-200">
                  Generate Emergency Recovery Kit
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {getBiometricName()} is enabled without emergency codes. Generate 8 backup codes to prevent lockout if your system credentials reset.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openTotpModal}
                className="px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-medium cursor-pointer transition-colors"
              >
                Generate Codes
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryBannerDismissed(true);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('openterm_recovery_banner_dismissed', 'true');
                  }
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 cursor-pointer transition-colors"
                title="Dismiss reminder"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by profile name, host, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1e1e2d] border border-[#2a2b38] focus:border-indigo-500/80 text-xs text-slate-100 placeholder-slate-500 pl-9 pr-3 py-1.5 rounded-md outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>{connections.length} saved</span>
          </div>
        </div>

        {/* Folder Filter Chips */}
        {availableFolders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 text-xs scrollbar-none">
            <button
              onClick={() => setSelectedFolder('All')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                selectedFolder === 'All'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#1e1e2d] text-slate-400 hover:text-white border border-[#2a2b38]'
              }`}
            >
              All ({connections.length})
            </button>
            {availableFolders.map((folder) => {
              const count = connections.filter((c) => c.folder === folder).length;
              return (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedFolder === folder
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#1e1e2d] text-slate-400 hover:text-white border border-[#2a2b38]'
                  }`}
                >
                  <Folder className="h-3 w-3 text-indigo-400" />
                  <span>{folder}</span>
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
            {connections.some((c) => !c.folder || !c.folder.trim()) && (
              <button
                onClick={() => setSelectedFolder('Uncategorized')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  selectedFolder === 'Uncategorized'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#1e1e2d] text-slate-400 hover:text-white border border-[#2a2b38]'
                }`}
              >
                Uncategorized ({connections.filter((c) => !c.folder || !c.folder.trim()).length})
              </button>
            )}
          </div>
        )}

        {/* Connections List or Locked Screen */}
        {vaultStatus.isEncrypted && !vaultStatus.isUnlocked ? (
          <div className="py-14 px-4 text-center border border-[#2a2b38] rounded-lg bg-[#1e1e2d] p-8 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Vault is Locked</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Your connection profiles and credentials are securely encrypted with AES-256-GCM. Enter your master password to unlock.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium cursor-pointer transition-colors shadow-sm"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>Unlock Vault</span>
            </button>
          </div>
        ) : isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono">
            Loading connection profiles...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 px-4 text-center border border-dashed border-[#2a2b38] rounded-lg bg-[#1e1e2d]/40">
            <Server className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-medium">No connection profiles</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {search ? 'No matches for your search.' : 'Add your first SSH target to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedConnections.map(({ folder, items }) => {
              const isCollapsed = Boolean(collapsedFolders[folder]);
              return (
                <div key={folder} className="space-y-1.5">
                  {(groupedConnections.length > 1 || folder !== 'Uncategorized') && (
                    <button
                      type="button"
                      onClick={() => toggleFolderCollapse(folder)}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer py-1 px-1"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <Folder className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{folder}</span>
                      <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.2 rounded bg-[#1e1e2d] border border-[#2a2b38]">
                        {items.length}
                      </span>
                    </button>
                  )}

                  {!isCollapsed && (
                    <div className="border border-[#2a2b38] rounded-lg bg-[#1e1e2d] divide-y divide-[#2a2b38] overflow-hidden">
                      {items.map((conn) => (
                        <div
                          key={conn.id}
                          className="group flex items-center justify-between px-4 py-3 hover:bg-[#252538] transition-colors cursor-pointer"
                          onClick={() => !isConnecting && onConnect(conn)}
                        >
                          {/* Left info */}
                          <div className="flex items-center gap-3.5 min-w-0 pr-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#11111a] border border-[#2a2b38] text-slate-400 group-hover:text-indigo-400 transition-colors shrink-0">
                              <Server className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs text-white truncate">
                                  {conn.name}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#11111a] text-slate-400 border border-[#2a2b38]">
                                  {conn.authType === 'key' ? (
                                    <>
                                      <Key className="h-2.5 w-2.5" />
                                      <span>key</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="h-2.5 w-2.5" />
                                      <span>pwd</span>
                                    </>
                                  )}
                                </span>
                                {conn.folder && selectedFolder === 'All' && (
                                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-[#11111a] text-slate-400 border border-[#2a2b38]">
                                    <Folder className="h-2.5 w-2.5 text-indigo-400" />
                                    <span>{conn.folder}</span>
                                  </span>
                                )}
                                {conn.bookmarks && conn.bookmarks.length > 0 && (
                                  <span
                                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-950/30 text-amber-300 border border-amber-800/40"
                                    title={`${conn.bookmarks.length} SFTP Bookmarks`}
                                  >
                                    <Bookmark className="h-2.5 w-2.5 text-amber-400" />
                                    <span>{conn.bookmarks.length}</span>
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                                {conn.username}@{conn.host}:{conn.port}
                              </p>
                            </div>
                          </div>

                          {/* Right actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline mr-2">
                              {formatDate(conn.updatedAt)}
                            </span>

                            <button
                              type="button"
                              disabled={isConnecting}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isConnecting) onConnect(conn);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-md text-xs font-medium cursor-pointer transition-colors disabled:opacity-40"
                              title="Connect session"
                            >
                              <span>Connect</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(conn);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#11111a] rounded-md cursor-pointer transition-colors"
                              title="Edit profile"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicate(conn.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#11111a] rounded-md cursor-pointer transition-colors"
                              title="Duplicate profile"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            {deleteConfirm === conn.id ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await remove(conn.id);
                                  setDeleteConfirm(null);
                                }}
                                onBlur={() => setDeleteConfirm(null)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(conn.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#11111a] rounded-md cursor-pointer transition-colors"
                                title="Delete profile"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VaultModal
        isOpen={isVaultModalOpen}
        status={vaultStatus}
        onClose={() => setIsVaultModalOpen(false)}
        onStatusChange={async () => {
          const status = await checkVaultStatus();
          if (status.isUnlocked) {
            load();
          }
        }}
      />

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        existingConnections={connections}
        onImportComplete={() => {
          load();
        }}
        onSaveConnection={async (conn) => {
          return await save(conn);
        }}
      />
    </div>
  );
};
