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
} from 'lucide-react';

interface DashboardProps {
  onNewConnection: () => void;
  onConnect: (conn: SavedConnection) => void;
  onEdit: (conn: SavedConnection) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNewConnection,
  onConnect,
  onEdit,
}) => {
  const { connections, isLoading, load, remove, duplicate } = useSavedConnectionStore();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const filtered = search
    ? connections.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.host.toLowerCase().includes(search.toLowerCase()) ||
          c.username.toLowerCase().includes(search.toLowerCase()),
      )
    : connections;

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

          <button
            type="button"
            onClick={onNewConnection}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>New Connection</span>
          </button>
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

        {/* Connections List */}
        {isLoading ? (
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
          <div className="border border-[#2a2b38] rounded-lg bg-[#1e1e2d] divide-y divide-[#2a2b38] overflow-hidden">
            {filtered.map((conn) => (
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
    </div>
  );
};
