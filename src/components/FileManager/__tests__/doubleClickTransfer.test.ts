import { describe, it, expect, vi } from 'vitest';
import { FileEntry } from '../../../types';

describe('Issue #44: Double-Click File Action Dispatcher', () => {
  const mockFile: FileEntry = {
    name: 'document.txt',
    path: '/home/user/document.txt',
    size: 1024,
    isDir: false,
    isSymlink: false,
  };

  const mockDir: FileEntry = {
    name: 'documents',
    path: '/home/user/documents',
    size: 4096,
    isDir: true,
    isSymlink: false,
  };

  const dispatchDoubleClick = (
    entry: FileEntry,
    action: 'transfer' | 'edit',
    callbacks: {
      onNavigate: (path: string) => void;
      onTransferItem?: (entry: FileEntry) => void;
      onEditFile?: (entry: FileEntry) => void;
    }
  ) => {
    if (entry.isDir) {
      callbacks.onNavigate(entry.path);
    } else if (action === 'edit') {
      callbacks.onEditFile?.(entry);
    } else if (callbacks.onTransferItem) {
      callbacks.onTransferItem(entry);
    } else {
      callbacks.onEditFile?.(entry);
    }
  };

  it('always navigates when entry is a directory regardless of action setting', () => {
    const onNavigate = vi.fn();
    const onTransferItem = vi.fn();
    const onEditFile = vi.fn();

    dispatchDoubleClick(mockDir, 'transfer', { onNavigate, onTransferItem, onEditFile });
    expect(onNavigate).toHaveBeenCalledWith('/home/user/documents');
    expect(onTransferItem).not.toHaveBeenCalled();
    expect(onEditFile).not.toHaveBeenCalled();

    onNavigate.mockClear();
    dispatchDoubleClick(mockDir, 'edit', { onNavigate, onTransferItem, onEditFile });
    expect(onNavigate).toHaveBeenCalledWith('/home/user/documents');
  });

  it('triggers transfer when entry is a file and action is transfer', () => {
    const onNavigate = vi.fn();
    const onTransferItem = vi.fn();
    const onEditFile = vi.fn();

    dispatchDoubleClick(mockFile, 'transfer', { onNavigate, onTransferItem, onEditFile });
    expect(onTransferItem).toHaveBeenCalledWith(mockFile);
    expect(onEditFile).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('triggers edit when entry is a file and action is edit', () => {
    const onNavigate = vi.fn();
    const onTransferItem = vi.fn();
    const onEditFile = vi.fn();

    dispatchDoubleClick(mockFile, 'edit', { onNavigate, onTransferItem, onEditFile });
    expect(onEditFile).toHaveBeenCalledWith(mockFile);
    expect(onTransferItem).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
