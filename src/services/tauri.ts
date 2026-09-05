import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SessionConfig, PaginatedEntries, TransferProgress } from '../types';

export const tauriApi = {
  ping: async (): Promise<string> => {
    return await invoke<string>('ping');
  },

  sshConnect: async (config: SessionConfig): Promise<string> => {
    return await invoke<string>('ssh_connect', { config });
  },

  sshDisconnect: async (sessionId: string): Promise<void> => {
    return await invoke<void>('ssh_disconnect', { sessionId });
  },

  sshWrite: async (sessionId: string, data: string): Promise<void> => {
    return await invoke<void>('ssh_write', { sessionId, data });
  },

  sshResizePty: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    return await invoke<void>('ssh_resize_pty', { sessionId, cols, rows });
  },

  onSshData: async (sessionId: string, callback: (data: string) => void): Promise<UnlistenFn> => {
    return await listen<string>(`ssh:data:${sessionId}`, (event) => {
      callback(event.payload);
    });
  },

  onSshClosed: async (sessionId: string, callback: () => void): Promise<UnlistenFn> => {
    return await listen<void>(`ssh:closed:${sessionId}`, () => {
      callback();
    });
  },

  localListDir: async (path: string, offset = 0, limit = 100): Promise<PaginatedEntries> => {
    return await invoke<PaginatedEntries>('local_list_dir', { path, offset, limit });
  },

  sftpListDir: async (
    sessionId: string,
    remotePath: string,
    offset = 0,
    limit = 100
  ): Promise<PaginatedEntries> => {
    return await invoke<PaginatedEntries>('sftp_list_dir', {
      sessionId,
      remotePath,
      offset,
      limit,
    });
  },

  sftpDownload: async (
    sessionId: string,
    remotePath: string,
    localPath: string,
    transferId: string
  ): Promise<void> => {
    return await invoke<void>('sftp_download', {
      sessionId,
      remotePath,
      localPath,
      transferId,
    });
  },

  sftpUpload: async (
    sessionId: string,
    localPath: string,
    remotePath: string,
    transferId: string
  ): Promise<void> => {
    return await invoke<void>('sftp_upload', {
      sessionId,
      localPath,
      remotePath,
      transferId,
    });
  },

  sftpCancelTransfer: async (transferId: string): Promise<void> => {
    return await invoke<void>('sftp_cancel_transfer', { transferId });
  },

  onTransferProgress: async (
    transferId: string,
    callback: (progress: TransferProgress) => void
  ): Promise<UnlistenFn> => {
    return await listen<TransferProgress>(`transfer:progress:${transferId}`, (event) => {
      callback(event.payload);
    });
  },
};
