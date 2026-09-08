import { create } from 'zustand';
import { SavedConnection, VaultStatus } from '../types';
import { tauriApi } from '../services/tauri';

interface SavedConnectionState {
  connections: SavedConnection[];
  isLoading: boolean;
  error: string | null;
  vaultStatus: VaultStatus;

  checkVaultStatus: () => Promise<VaultStatus>;
  unlockVault: (password: string) => Promise<void>;
  lockVault: () => Promise<void>;
  load: () => Promise<void>;
  save: (conn: SavedConnection) => Promise<SavedConnection>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<SavedConnection>;
}

export const useSavedConnectionStore = create<SavedConnectionState>((set, get) => ({
  connections: [],
  isLoading: false,
  error: null,
  vaultStatus: { isEncrypted: false, isUnlocked: true },

  checkVaultStatus: async () => {
    try {
      const status = await tauriApi.vaultGetStatus();
      set({ vaultStatus: status });
      return status;
    } catch (err) {
      console.error('Failed to get vault status:', err);
      return { isEncrypted: false, isUnlocked: true };
    }
  },

  unlockVault: async (password: string) => {
    set({ isLoading: true, error: null });
    try {
      const connections = await tauriApi.vaultUnlock(password);
      const status = await tauriApi.vaultGetStatus();
      set({ connections, vaultStatus: status, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isLoading: false, error: msg });
      throw err;
    }
  },

  lockVault: async () => {
    try {
      await tauriApi.vaultLock();
      const status = await tauriApi.vaultGetStatus();
      set({ connections: [], vaultStatus: status });
    } catch (err) {
      console.error('Failed to lock vault:', err);
    }
  },

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await tauriApi.listConnections();
      set({ connections, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: String(err) });
    }
  },

  save: async (conn) => {
    const saved = await tauriApi.saveConnection(conn);
    await get().load();
    return saved;
  },

  remove: async (id) => {
    await tauriApi.deleteConnection(id);
    await get().load();
  },

  duplicate: async (id) => {
    const source = get().connections.find((c) => c.id === id);
    if (!source) throw new Error('Connection not found');
    const copy: SavedConnection = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (Copy)`,
      createdAt: 0,
      updatedAt: 0,
    };
    return get().save(copy);
  },
}));
