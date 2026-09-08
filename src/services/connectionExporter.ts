import { SavedConnection } from '../types';

export function exportToOpenTermJson(connections: SavedConnection[]): string {
  return JSON.stringify(connections, null, 2);
}

export function exportToFileZillaXml(connections: SavedConnection[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FileZilla3 version="3.71.1" platform="all">\n\t<Servers>\n';

  for (const conn of connections) {
    const passTag = conn.password
      ? `\t\t\t<Pass encoding="base64">${typeof btoa !== 'undefined' ? btoa(conn.password) : Buffer.from(conn.password).toString('base64')}</Pass>\n`
      : '';
    const keyTag = conn.privateKeyPath
      ? `\t\t\t<Keyfile>${escapeXml(conn.privateKeyPath)}</Keyfile>\n`
      : '';

    let bookmarksXml = '';
    if (conn.bookmarks && conn.bookmarks.length > 0) {
      for (const bm of conn.bookmarks) {
        bookmarksXml += `\t\t\t<Bookmark>\n\t\t\t\t<Name>${escapeXml(bm.name)}</Name>\n`;
        if (bm.localPath) {
          bookmarksXml += `\t\t\t\t<LocalDir>${escapeXml(bm.localPath)}</LocalDir>\n`;
        }
        if (bm.remotePath) {
          bookmarksXml += `\t\t\t\t<RemoteDir>${encodeFileZillaRemoteDir(bm.remotePath)}</RemoteDir>\n`;
        }
        bookmarksXml += '\t\t\t</Bookmark>\n';
      }
    }

    const folderOpen = conn.folder ? `\t\t<Folder name="${escapeXml(conn.folder)}">\n` : '';
    const folderClose = conn.folder ? '\t\t</Folder>\n' : '';

    xml += `${folderOpen}\t\t<Server>
\t\t\t<Host>${escapeXml(conn.host)}</Host>
\t\t\t<Port>${conn.port}</Port>
\t\t\t<Protocol>1</Protocol>
\t\t\t<User>${escapeXml(conn.username)}</User>
${passTag}${keyTag}\t\t\t<Name>${escapeXml(conn.name)}</Name>
${bookmarksXml}\t\t</Server>\n${folderClose}`;
  }

  xml += '\t</Servers>\n</FileZilla3>\n';
  return xml;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function encodeFileZillaRemoteDir(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  if (!clean) return '1 0';
  const parts = clean.split('/');
  let res = '1 0';
  for (const p of parts) {
    res += ` ${p.length} ${p}`;
  }
  return res;
}
