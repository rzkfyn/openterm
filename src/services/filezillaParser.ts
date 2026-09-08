import { SavedConnection, ConnectionBookmark } from '../types';

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  children: XmlNode[];
}

function parseSimpleXml(xml: string): XmlNode {
  const stack: XmlNode[] = [{ tag: 'root', attrs: {}, text: '', children: [] }];
  // Match XML tags or text content between tags
  const tagRegex = /<(\/)?([a-zA-Z0-9_:]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xml)) !== null) {
    if (match[4]) {
      const t = match[4].trim();
      if (t) {
        const top = stack[stack.length - 1];
        top.text += (top.text ? ' ' : '') + t;
      }
    } else if (match[1]) {
      // Closing tag </tag>
      if (stack.length > 1) {
        const closed = stack.pop()!;
        stack[stack.length - 1].children.push(closed);
      }
    } else {
      // Opening tag <tag ...>
      const tag = match[2];
      // Skip XML declarations or comments
      if (tag.startsWith('?') || tag.startsWith('!')) continue;

      const rawAttrs = match[3] || '';
      const isSelfClosing = rawAttrs.trim().endsWith('/');
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9_:]+)="([^"]*)"/g;
      let am: RegExpExecArray | null;
      while ((am = attrRegex.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2];
      }

      const node: XmlNode = { tag, attrs, text: '', children: [] };
      if (isSelfClosing) {
        stack[stack.length - 1].children.push(node);
      } else {
        stack.push(node);
      }
    }
  }

  return stack[0];
}

/**
 * Decode FileZilla's serialized remote path format.
 * Format is typically: `1 0 <segment_len> <segment_name> ...`
 * Example: `1 0 3 opt 8 service1` -> `/opt/service1`
 */
export function decodeFileZillaRemoteDir(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;

  const segments: string[] = [];
  let i = 2; // skip header (e.g. '1 0')
  while (i < parts.length) {
    const len = parseInt(parts[i], 10);
    if (isNaN(len)) {
      i++;
      continue;
    }
    i++;
    if (i < parts.length) {
      segments.push(parts[i]);
      i++;
    }
  }

  if (segments.length === 0) {
    return trimmed;
  }

  return '/' + segments.join('/');
}

export function parseFileZillaXml(xmlString: string): Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>[] {
  if (!xmlString || !xmlString.trim()) return [];

  const root = parseSimpleXml(xmlString);
  const connections: Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  function findChild(node: XmlNode, tag: string): XmlNode | undefined {
    return node.children.find((c) => c.tag.toLowerCase() === tag.toLowerCase());
  }

  function findChildren(node: XmlNode, tag: string): XmlNode[] {
    return node.children.filter((c) => c.tag.toLowerCase() === tag.toLowerCase());
  }

  function traverse(node: XmlNode, currentFolder: string) {
    for (const child of node.children) {
      if (child.tag.toLowerCase() === 'folder') {
        const folderName = child.attrs.name || child.text || '';
        const nextFolder = currentFolder
          ? folderName ? `${currentFolder}/${folderName}` : currentFolder
          : folderName;
        traverse(child, nextFolder);
      } else if (child.tag.toLowerCase() === 'server') {
        const host = findChild(child, 'Host')?.text || '';
        const portStr = findChild(child, 'Port')?.text || '22';
        const port = parseInt(portStr, 10) || 22;
        const username = findChild(child, 'User')?.text || '';
        const name = findChild(child, 'Name')?.text || host;
        const keyfile = findChild(child, 'Keyfile')?.text;

        let password: string | undefined;
        const passNode = findChild(child, 'Pass');
        if (passNode) {
          const encoding = passNode.attrs.encoding;
          const text = passNode.text;
          if (encoding === 'base64') {
            try {
              password = typeof atob !== 'undefined'
                ? atob(text)
                : Buffer.from(text, 'base64').toString('utf8');
            } catch {
              password = text;
            }
          } else {
            password = text;
          }
        }

        const bookmarks: ConnectionBookmark[] = [];
        const bmNodes = findChildren(child, 'Bookmark');
        for (const bm of bmNodes) {
          const bmName = findChild(bm, 'Name')?.text || 'Bookmark';
          const localPath = findChild(bm, 'LocalDir')?.text;
          const remoteRaw = findChild(bm, 'RemoteDir')?.text;
          const remotePath = remoteRaw ? decodeFileZillaRemoteDir(remoteRaw) : undefined;
          bookmarks.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2),
            name: bmName,
            localPath: localPath || undefined,
            remotePath,
          });
        }

        connections.push({
          name,
          host,
          port,
          username,
          authType: keyfile ? 'key' : 'password',
          privateKeyPath: keyfile || undefined,
          password: password || undefined,
          folder: currentFolder || undefined,
          bookmarks: bookmarks.length > 0 ? bookmarks : undefined,
        });
      } else {
        traverse(child, currentFolder);
      }
    }
  }

  traverse(root, '');
  return connections;
}
