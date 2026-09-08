import { describe, it, expect } from 'vitest';
import { parseFileZillaXml, decodeFileZillaRemoteDir } from '../filezillaParser';
import { exportToOpenTermJson, exportToFileZillaXml } from '../connectionExporter';
import { SavedConnection } from '../../types';

describe('filezillaParser', () => {
  it('decodes FileZilla space-separated remote dir format', () => {
    const raw = '1 0 3 opt 8 service1';
    expect(decodeFileZillaRemoteDir(raw)).toBe('/opt/service1');

    const multi = '1 0 3 opt 14 service1-long 10 service1';
    expect(decodeFileZillaRemoteDir(multi)).toBe('/opt/service1-long/service1');
  });

  it('parses nested folders, servers, passwords, and bookmarks', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3 version="3.71.1" platform="windows">
  <Servers>
    <Folder expanded="0">App Test<Server>
        <Host>127.0.0.1</Host>
        <Port>22</Port>
        <Protocol>1</Protocol>
        <User>testuser</User>
        <Pass encoding="base64">UGFzc3dvcmRUZXN0MTIzNA==</Pass>
        <Name>App Test</Name>
        <Bookmark>
          <Name>Service 1</Name>
          <LocalDir>C:\\work\\service1</LocalDir>
          <RemoteDir>1 0 3 opt 8 service1</RemoteDir>
        </Bookmark>
      </Server>
      <Server>
        <Host>192.168.1.50</Host>
        <Port>2222</Port>
        <Protocol>1</Protocol>
        <User>deploy</User>
        <Keyfile>/home/user/.ssh/id_ed25519</Keyfile>
        <Name>Deploy Server</Name>
      </Server>
    </Folder>
  </Servers>
</FileZilla3>`;

    const result = parseFileZillaXml(xml);
    expect(result.length).toBe(2);

    // First server
    expect(result[0].name).toBe('App Test');
    expect(result[0].host).toBe('127.0.0.1');
    expect(result[0].port).toBe(22);
    expect(result[0].username).toBe('testuser');
    expect(result[0].password).toBe('PasswordTest1234');
    expect(result[0].authType).toBe('password');
    expect(result[0].folder).toBe('App Test');
    expect(result[0].bookmarks?.length).toBe(1);
    expect(result[0].bookmarks?.[0].name).toBe('Service 1');
    expect(result[0].bookmarks?.[0].localPath).toBe('C:\\work\\service1');
    expect(result[0].bookmarks?.[0].remotePath).toBe('/opt/service1');

    // Second server with keyfile
    expect(result[1].name).toBe('Deploy Server');
    expect(result[1].host).toBe('192.168.1.50');
    expect(result[1].port).toBe(2222);
    expect(result[1].username).toBe('deploy');
    expect(result[1].authType).toBe('key');
    expect(result[1].privateKeyPath).toBe('/home/user/.ssh/id_ed25519');
    expect(result[1].folder).toBe('App Test');
  });

  it('handles empty XML or missing servers gracefully', () => {
    expect(parseFileZillaXml('')).toEqual([]);
    expect(parseFileZillaXml('<FileZilla3></FileZilla3>')).toEqual([]);
  });
});

describe('connectionExporter', () => {
  const sampleConnections: SavedConnection[] = [
    {
      id: 'conn-1',
      name: 'Test Server',
      host: '127.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password',
      password: 'secretpassword',
      folder: 'Servers',
      createdAt: 1000,
      updatedAt: 2000,
    },
  ];

  it('exports to formatted JSON', () => {
    const json = exportToOpenTermJson(sampleConnections);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Test Server');
  });

  it('exports to FileZilla XML format with base64 encoded password', () => {
    const xml = exportToFileZillaXml(sampleConnections);
    expect(xml).toContain('<FileZilla3');
    expect(xml).toContain('<Host>127.0.0.1</Host>');
    expect(xml).toContain('<Pass encoding="base64">c2VjcmV0cGFzc3dvcmQ=</Pass>');
  });
});
