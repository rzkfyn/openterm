import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  SessionConfig,
  PaginatedEntries,
  TransferProgress,
  SavedConnection,
  FileStatInfo,
  VaultStatus,
  TotpConfig,
  TotpSetupInfo,
} from '../types';

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

  // --- Vault & Master Password ---
  vaultGetStatus: async (): Promise<VaultStatus> => {
    return await invoke<VaultStatus>('vault_get_status');
  },

  vaultUnlock: async (masterPassword: string): Promise<SavedConnection[]> => {
    return await invoke<SavedConnection[]>('vault_unlock', { masterPassword });
  },

  vaultLock: async (): Promise<void> => {
    return await invoke<void>('vault_lock');
  },

  vaultSetPassword: async (
    newPassword: string,
    oldPassword?: string
  ): Promise<string> => {
    return await invoke<string>('vault_set_password', {
      oldPassword: oldPassword || null,
      newPassword,
    });
  },

  vaultRecover: async (
    recoveryKey: string,
    newPassword: string,
    totpCode?: string
  ): Promise<string> => {
    return await invoke<string>('vault_recover', {
      recoveryKey,
      totpCode: totpCode || null,
      newPassword,
    });
  },

  vaultRemovePassword: async (currentPassword: string): Promise<void> => {
    return await invoke<void>('vault_remove_password', { currentPassword });
  },

  // --- TOTP 2FA & App Lock ---
  totpGetConfig: async (): Promise<TotpConfig> => {
    return await invoke<TotpConfig>('totp_get_config');
  },

  totpGenerateSecret: async (): Promise<TotpSetupInfo> => {
    return await invoke<TotpSetupInfo>('totp_generate_secret');
  },

  totpUpdateIdleTimeout: async (mins: number): Promise<void> => {
    return await invoke<void>('totp_update_idle_timeout', { mins });
  },

  totpEnable: async (secret: string, code: string): Promise<string[]> => {
    return await invoke<string[]>('totp_enable', { secret, code });
  },

  totpDisable: async (codeOrBackup: string): Promise<void> => {
    return await invoke<void>('totp_disable', { codeOrBackup });
  },

  totpValidateLogin: async (codeOrBackup: string): Promise<boolean> => {
    return await invoke<boolean>('totp_validate_login', { codeOrBackup });
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

  localStat: async (path: string): Promise<FileStatInfo> => {
    return await invoke<FileStatInfo>('local_stat', { path });
  },

  sftpStat: async (sessionId: string, path: string): Promise<FileStatInfo> => {
    return await invoke<FileStatInfo>('sftp_stat', { sessionId, path });
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

  onDragDropEvent: async (
    callback: (event: {
      type: 'enter' | 'over' | 'drop' | 'leave';
      paths?: string[];
      position?: { x: number; y: number };
    }) => void
  ): Promise<UnlistenFn> => {
    return await getCurrentWebview().onDragDropEvent((event) => {
      callback(event.payload);
    });
  },
};
