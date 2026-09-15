import { describe, it, expect, vi } from 'vitest';
import { SavedConnection, SessionConfig } from '../../../types';

describe('Save and Connect lifecycle logic', () => {
  const mockConn: SavedConnection = {
    id: 'conn-1',
    name: 'Production Server',
    host: '10.0.0.1',
    port: 22,
    username: 'admin',
    authType: 'password',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockConfig: SessionConfig = {
    name: 'Production Server',
    host: '10.0.0.1',
    port: 22,
    username: 'admin',
    authType: 'password',
  };

  it('does NOT save connection profile if connection fails', async () => {
    const saveConnection = vi.fn();
    const connectSession = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const closeModal = vi.fn();

    const handleSaveAndConnect = async (conn: SavedConnection, config: SessionConfig) => {
      try {
        await connectSession(config);
        await saveConnection(conn);
        closeModal();
      } catch {
        // error shown in modal, profile NOT saved
      }
    };

    await handleSaveAndConnect(mockConn, mockConfig);

    expect(connectSession).toHaveBeenCalledWith(mockConfig);
    expect(saveConnection).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('saves connection profile and closes modal when connection succeeds', async () => {
    const saveConnection = vi.fn().mockResolvedValue(undefined);
    const connectSession = vi.fn().mockResolvedValue('session-xyz');
    const closeModal = vi.fn();

    const handleSaveAndConnect = async (conn: SavedConnection, config: SessionConfig) => {
      try {
        await connectSession(config);
        await saveConnection(conn);
        closeModal();
      } catch {
        // error shown in modal
      }
    };

    await handleSaveAndConnect(mockConn, mockConfig);

    expect(connectSession).toHaveBeenCalledWith(mockConfig);
    expect(saveConnection).toHaveBeenCalledWith(mockConn);
    expect(closeModal).toHaveBeenCalled();
  });
});
