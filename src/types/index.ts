export type AuthType = 'password' | 'key';
export type SessionConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface SessionConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  status?: SessionConnectionStatus;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  isSymlink: boolean;
  modified?: number;
  permissions?: number;
}

export interface PaginatedEntries {
  path: string;
  entries: FileEntry[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface FileStatInfo {
  exists: boolean;
  size: number;
  modified?: number;
  isDir: boolean;
}

export type ConflictAction = 'overwrite' | 'overwrite_newer' | 'overwrite_size' | 'rename' | 'skip';

export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';

export interface TransferProgress {
  transferId: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  status: TransferStatus;
  error?: string;
}

export type ViewMode = 'terminal' | 'sftp' | 'split';

/** Saved connection profile — no password/passphrase stored on disk. */
export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  privateKeyPath?: string;
  password?: string;
  passphrase?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultStatus {
  isEncrypted: boolean;
  isUnlocked: boolean;
}

export interface TotpConfig {
  enabled: boolean;
  idleTimeoutMins: number;
  hasBackupCodes: boolean;
}

export interface TotpSetupInfo {
  secret: string;
  uri: string;
}
