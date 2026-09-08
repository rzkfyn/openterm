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
} from 'lucide-react';
import { VaultModal } from '../Modal/VaultModal';
import { TotpModal } from '../Modal/TotpModal';
import { ImportExportModal } from '../Modal/ImportExportModal';
import { TotpConfig } from '../../types';
import { useTotpStore } from '../../stores/totpStore';

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
  const [isTotpModalOpen, setIsTotpModalOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const { config: totpConfig, loadConfig: loadTotp } = useTotpStore();

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
      <div className="w-full max-w-4xl mx-auto px-6 py-10">
        {/* Top Header / Welcome */}
        <div className="flex items-center justify-between pb-6 mb-8 border-b border-[#2a2b38]">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTotpModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                totpConfig.enabled
                  ? 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50'
                  : 'bg-[#1e1e2d] border-[#2a2b38] text-slate-300 hover:text-white hover:bg-[#252538]'
              }`}
              title={totpConfig.enabled ? '2FA Active (Click to manage)' : 'Enable 2FA App Lock'}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>{totpConfig.enabled ? '2FA Active' : 'Enable 2FA'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                vaultStatus.isEncrypted
                  ? vaultStatus.isUnlocked
                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-amber-950/40 border-amber-700/50 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-[#1e1e2d] border-[#2a2b38] text-slate-300 hover:text-white hover:bg-[#252538]'
              }`}
              title={
                vaultStatus.isEncrypted
                  ? vaultStatus.isUnlocked
                    ? 'Vault Unlocked (Click to manage or lock)'
                    : 'Vault Locked'
                  : 'Enable Master Password Vault'
              }
            >
              <Shield className="h-3.5 w-3.5" />
              <span>
                {vaultStatus.isEncrypted
                  ? vaultStatus.isUnlocked
                    ? 'Vault Active'
                    : 'Vault Locked'
                  : 'Enable Vault'}
              </span>
            </button>

            {vaultStatus.isEncrypted && vaultStatus.isUnlocked && (
              <button
                type="button"
                onClick={lockVault}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-slate-400 hover:text-rose-300 hover:border-rose-900/40 text-xs font-medium cursor-pointer transition-colors"
                title="Lock Vault"
              >
                <Lock className="h-3 w-3" />
                <span>Lock</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsImportExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2d] border border-[#2a2b38] text-slate-300 hover:text-white hover:border-slate-600 text-xs font-medium cursor-pointer transition-colors"
              title="Import or Export connections"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Import / Export</span>
            </button>

            <button
              type="button"
              onClick={onNewConnection}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>New Connection</span>
            </button>
          </div>
        </div>

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
                          onClick={() => onConnect(conn)}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onConnect(conn);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-md text-xs font-medium cursor-pointer transition-colors"
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

      <TotpModal
        isOpen={isTotpModalOpen}
        config={totpConfig}
        onClose={() => setIsTotpModalOpen(false)}
        onConfigChange={loadTotp}
      />

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        existingConnections={connections}
        onImportComplete={() => {
          load();
        }}
        onSaveConnection={async (conn) => {
          return await save(conn as any);
        }}
      />
    </div>
  );
};
