import { describe, it, expect, beforeEach } from 'vitest';
import { joinRemotePath, getBasename } from '../../../utils/pathUtils';
import { useFileManagerStore } from '../../../stores/fileManagerStore';

describe('Drag and drop path resolution and navigation preservation', () => {
  beforeEach(() => {
    useFileManagerStore.setState({
      local: {
        currentPath: 'C:\\Users\\tester\\Downloads',
        entries: [],
        total: 0,
        offset: 0,
        hasMore: false,
        isLoading: false,
        error: null,
        selectedPaths: [],
        history: ['C:\\Users\\tester\\Downloads'],
        historyIndex: 0,
      },
      remote: {
        currentPath: '/home/ubuntu/app',
        entries: [
          {
            name: 'subfolder',
            path: '/home/ubuntu/app/subfolder',
            size: 4096,
            isDir: true,
            isSymlink: false,
          },
        ],
        total: 1,
        offset: 0,
        hasMore: false,
        isLoading: false,
        error: null,
        selectedPaths: [],
        history: ['/home/ubuntu/app'],
        historyIndex: 0,
      },
    });
  });

  it('resolves destination to target folder when dropped on folder row', () => {
    const droppedOnFolder = '/home/ubuntu/app/subfolder';
    const localFile = 'C:\\Users\\tester\\Downloads\\package.json';
    const fileName = getBasename(localFile);
    expect(fileName).toBe('package.json');

    const destPath = joinRemotePath(droppedOnFolder, fileName);
    expect(destPath).toBe('/home/ubuntu/app/subfolder/package.json');
  });

  it('resolves destination to current remote path when dropped on pane area', () => {
    const remoteCurrent = useFileManagerStore.getState().remote.currentPath;
    const localFile = 'C:\\Users\\tester\\Downloads\\archive.tar.gz';
    const fileName = getBasename(localFile);
    expect(fileName).toBe('archive.tar.gz');

    const destPath = joinRemotePath(remoteCurrent, fileName);
    expect(destPath).toBe('/home/ubuntu/app/archive.tar.gz');
  });

  it('normalizes Windows backslashes in destination path', () => {
    const folderWithBackslashes = '\\home\\ubuntu\\app\\config';
    const file = 'settings.env';
    const destPath = joinRemotePath(folderWithBackslashes, file);
    expect(destPath).toBe('/home/ubuntu/app/config/settings.env');
  });

  it('preserves current navigation path across transfers without reverting to root', () => {
    const initialRemote = useFileManagerStore.getState().remote.currentPath;
    expect(initialRemote).toBe('/home/ubuntu/app');

    // Simulate transfer completing into subfolder
    const targetFolder = '/home/ubuntu/app/subfolder';
    const transferDest = joinRemotePath(targetFolder, 'data.csv');
    expect(transferDest).toBe('/home/ubuntu/app/subfolder/data.csv');

    // Current path in state remains intact
    expect(useFileManagerStore.getState().remote.currentPath).toBe('/home/ubuntu/app');
  });
});
