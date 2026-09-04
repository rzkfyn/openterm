export type AuthType = 'password' | 'key';

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
