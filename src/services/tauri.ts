import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SessionConfig, PaginatedEntries, TransferProgress, SavedConnection } from '../types';

export const tauriApi = {
  ping: async (): Promise<string> => {
    return await invoke<string>('ping');
  },

  openUrl: async (url: string): Promise<void> => {
    return await invoke<void>('open_url', { url });
  },

  // --- Saved connections ---
  listConnections: async (): Promise<SavedConnection[]> => {
    return await invoke<SavedConnection[]>('list_connections');
  },

  saveConnection: async (connection: SavedConnection): Promise<SavedConnection> => {
    return await invoke<SavedConnection>('save_connection', { connection });
  },

  deleteConnection: async (id: string): Promise<void> => {
    return await invoke<void>('delete_connection', { id });
  },

  // --- SSH ---

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

  localRemove: async (path: string, isDir: boolean): Promise<void> => {
    return await invoke<void>('local_remove', { path, isDir });
  },

  localRename: async (oldPath: string, newPath: string): Promise<void> => {
    return await invoke<void>('local_rename', { oldPath, newPath });
  },

  localMkdir: async (path: string): Promise<void> => {
    return await invoke<void>('local_mkdir', { path });
  },

  localTouch: async (path: string): Promise<void> => {
    return await invoke<void>('local_touch', { path });
  },

  sftpRemove: async (sessionId: string, path: string, isDir: boolean): Promise<void> => {
    return await invoke<void>('sftp_remove', { sessionId, path, isDir });
  },

  sftpRename: async (sessionId: string, oldPath: string, newPath: string): Promise<void> => {
    return await invoke<void>('sftp_rename', { sessionId, oldPath, newPath });
  },

  sftpMkdir: async (sessionId: string, path: string): Promise<void> => {
    return await invoke<void>('sftp_mkdir', { sessionId, path });
  },

  sftpTouch: async (sessionId: string, path: string): Promise<void> => {
    return await invoke<void>('sftp_touch', { sessionId, path });
  },

  sftpChmod: async (sessionId: string, path: string, mode: number): Promise<void> => {
    return await invoke<void>('sftp_chmod', { sessionId, path, mode });
  },

  sftpReadTextFile: async (sessionId: string, path: string, maxBytes?: number): Promise<string> => {
    return await invoke<string>('sftp_read_text_file', { sessionId, path, maxBytes });
  },

  sftpWriteTextFile: async (sessionId: string, path: string, content: string): Promise<void> => {
    return await invoke<void>('sftp_write_text_file', { sessionId, path, content });
  },

  onTransferProgress: async (
    transferId: string,
    callback: (progress: TransferProgress) => void
  ): Promise<UnlistenFn> => {
    return await listen<TransferProgress>(`transfer:progress:${transferId}`, (event) => {
      callback(event.payload);
    });
  },

  onWindowDragDrop: async (
    callback: (event: { paths: string[]; position: { x: number; y: number } }) => void
  ): Promise<UnlistenFn> => {
    return await listen<{ paths: string[]; position: { x: number; y: number } }>(
      'tauri://drag-drop',
      (event) => {
        callback(event.payload);
      }
    );
  },
};
