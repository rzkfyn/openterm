import { create } from 'zustand';
import { TransferProgress } from '../types';
import { tauriApi } from '../services/tauri';

interface TransferState {
  transfers: Record<string, TransferProgress>;
  
  startDownload: (
    sessionId: string,
    remotePath: string,
    localPath: string
  ) => Promise<string>;
  startUpload: (
    sessionId: string,
    localPath: string,
    remotePath: string
  ) => Promise<string>;
  cancelTransfer: (transferId: string) => Promise<void>;
  updateTransferProgress: (progress: TransferProgress) => void;
  clearCompleted: () => void;
}

export const useTransferStore = create<TransferState>((set, get) => ({
  transfers: {},

  updateTransferProgress: (progress) => {
    set((state) => ({
      transfers: {
        ...state.transfers,
        [progress.transferId]: progress,
      },
    }));
  },

  startDownload: async (sessionId, remotePath, localPath) => {
    const transferId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileName = remotePath.split('/').pop() || remotePath;

    // Initial state
    set((state) => ({
      transfers: {
        ...state.transfers,
        [transferId]: {
          transferId,
          fileName,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: 0,
          status: 'pending',
        },
      },
    }));

    // Listen to transfer progress events
    const unlisten = await tauriApi.onTransferProgress(transferId, (progress) => {
      get().updateTransferProgress(progress);
      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
        unlisten();
      }
    });

    try {
      await tauriApi.sftpDownload(sessionId, remotePath, localPath, transferId);
    } catch (err: unknown) {
      get().updateTransferProgress({
        transferId,
        fileName,
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      unlisten();
    }

    return transferId;
  },

  startUpload: async (sessionId, localPath, remotePath) => {
    const transferId = `up-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileName = localPath.split('/').pop() || localPath;

    set((state) => ({
      transfers: {
        ...state.transfers,
        [transferId]: {
          transferId,
          fileName,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: 0,
          status: 'pending',
        },
      },
    }));

    const unlisten = await tauriApi.onTransferProgress(transferId, (progress) => {
      get().updateTransferProgress(progress);
      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
        unlisten();
      }
    });

    try {
      await tauriApi.sftpUpload(sessionId, localPath, remotePath, transferId);
    } catch (err: unknown) {
      get().updateTransferProgress({
        transferId,
        fileName,
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      unlisten();
    }

    return transferId;
  },

  cancelTransfer: async (transferId) => {
    try {
      await tauriApi.sftpCancelTransfer(transferId);
    } catch (e) {
      console.error('Failed to cancel transfer:', e);
    }
  },

  clearCompleted: () => {
    set((state) => {
      const active: Record<string, TransferProgress> = {};
      for (const [id, t] of Object.entries(state.transfers)) {
        if (t.status === 'transferring' || t.status === 'pending') {
          active[id] = t;
        }
      }
      return { transfers: active };
    });
  },
}));
