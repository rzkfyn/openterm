import { create } from 'zustand';
import { SavedConnection } from '../types';
import { tauriApi } from '../services/tauri';

interface SavedConnectionState {
  connections: SavedConnection[];
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
  save: (conn: SavedConnection) => Promise<SavedConnection>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<SavedConnection>;
}

export const useSavedConnectionStore = create<SavedConnectionState>((set, get) => ({
  connections: [],
  isLoading: false,
  error: null,

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
