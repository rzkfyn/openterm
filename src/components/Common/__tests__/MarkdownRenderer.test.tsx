import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { tauriApi } from '../../../services/tauri';

// Mock tauriApi.openUrl
vi.mock('../../../services/tauri', () => ({
  tauriApi: {
    openUrl: vi.fn().mockResolvedValue(undefined),
  },
}));

// Helper to traverse React element tree
function findElement(node: any, predicate: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children.flat(Infinity)
      : [node.props.children];
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Headings', () => {
    it('renders # as h1', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="# Major Release 1.0" />);
      expect(html).toContain('<h1');
      expect(html).toContain('Major Release 1.0</h1>');
    });

    it('renders ## as h2', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="## New Features" />);
      expect(html).toContain('<h2');
      expect(html).toContain('New Features</h2>');
    });

    it('renders ### as h3', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="### Bug Fixes" />);
      expect(html).toContain('<h3');
      expect(html).toContain('Bug Fixes</h3>');
    });

    it('renders headings with inline formatting', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="## Version **v0.7.2**" />);
      expect(html).toContain('<h2');
      expect(html).toContain('<strong>v0.7.2</strong>');
    });
  });

  describe('Lists', () => {
    it('renders unordered lists with hyphen and asterisk bullets', () => {
      const markdown = `- First item\n- Second item\n* Third item`;
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<ul');
      expect(html).toContain('<li>First item</li>');
      expect(html).toContain('<li>Second item</li>');
      expect(html).toContain('<li>Third item</li>');
      expect(html).toContain('</ul>');
    });

    it('renders ordered lists with numbering', () => {
      const markdown = `1. Step one\n2. Step two\n3. Step three`;
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<ol');
      expect(html).toContain('<li>Step one</li>');
      expect(html).toContain('<li>Step two</li>');
      expect(html).toContain('<li>Step three</li>');
      expect(html).toContain('</ol>');
    });

    it('renders list items with inline formatting', () => {
      const markdown = `- Added support for **SSH** keys\n- Fixed \`osc7\` directory sync`;
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<strong>SSH</strong>');
      expect(html).toContain('osc7</code>');
    });
  });

  describe('Code Blocks and Inline Code', () => {
    it('renders inline code with styled code tag', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="Run `bun test` to verify." />);
      expect(html).toContain('<code');
      expect(html).toContain('bun test</code>');
    });

    it('renders fenced code blocks with language and copy button', () => {
      const markdown = "```bash\nbun install\nbun test\n```";
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('bun install\nbun test');
      expect(html).toContain('bash');
    });

    it('handles code blocks without language tag', () => {
      const markdown = "```\nplain text code\n```";
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<pre');
      expect(html).toContain('plain text code');
    });

    it('handles unclosed code block gracefully without throwing', () => {
      const markdown = "```typescript\nconst a = 1;";
      expect(() => renderToStaticMarkup(<MarkdownRenderer content={markdown} />)).not.toThrow();
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('const a = 1;');
    });
  });

  describe('Bold and Italic', () => {
    it('renders double asterisk and double underscore as strong', () => {
      const htmlAsterisks = renderToStaticMarkup(<MarkdownRenderer content="This is **bold** text." />);
      expect(htmlAsterisks).toContain('<strong>bold</strong>');

      const htmlUnderscores = renderToStaticMarkup(<MarkdownRenderer content="This is __bold__ text." />);
      expect(htmlUnderscores).toContain('<strong>bold</strong>');
    });

    it('renders single asterisk and single underscore as em', () => {
      const htmlAsterisks = renderToStaticMarkup(<MarkdownRenderer content="This is *italic* text." />);
      expect(htmlAsterisks).toContain('<em>italic</em>');

      const htmlUnderscores = renderToStaticMarkup(<MarkdownRenderer content="This is _italic_ text." />);
      expect(htmlUnderscores).toContain('<em>italic</em>');
    });

    it('renders combined bold and italic', () => {
      const html = renderToStaticMarkup(<MarkdownRenderer content="***bold and italic***" />);
      expect(html).toContain('<strong><em>bold and italic</em></strong>');
    });
  });

  describe('Links and Security', () => {
    it('renders safe https links as clickable anchor', () => {
      const markdown = '[OpenTerm Releases](https://github.com/openterm/openterm/releases)';
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<a');
      expect(html).toContain('href="https://github.com/openterm/openterm/releases"');
      expect(html).toContain('OpenTerm Releases</a>');
    });

    it('renders safe http links as clickable anchor', () => {
      const markdown = '[Doc](http://example.com/docs)';
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<a');
      expect(html).toContain('href="http://example.com/docs"');
    });

    it('invokes tauriApi.openUrl when safe link is clicked', async () => {
      const url = 'https://github.com/openterm/openterm';
      const tree = MarkdownRenderer({ content: `[GitHub](${url})` }) as React.ReactElement;
      const anchor = findElement(tree, (n) => n.type === 'a');

      expect(anchor).not.toBeNull();
      const preventDefault = vi.fn();
      anchor.props.onClick({ preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(tauriApi.openUrl).toHaveBeenCalledWith(url);
    });

    it('falls back to window.open when tauriApi.openUrl rejects', async () => {
      const mockOpen = vi.fn();
      vi.stubGlobal('window', { open: mockOpen });

      (tauriApi.openUrl as any).mockRejectedValueOnce(new Error('Tauri IPC failed'));

      const url = 'https://github.com/openterm/openterm';
      const tree = MarkdownRenderer({ content: `[GitHub](${url})` }) as React.ReactElement;
      const anchor = findElement(tree, (n) => n.type === 'a');

      expect(anchor).not.toBeNull();
      const preventDefault = vi.fn();
      anchor.props.onClick({ preventDefault });

      // Wait a microtask tick for catch handler to fire
      await Promise.resolve();

      expect(mockOpen).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
      vi.unstubAllGlobals();
    });

    it('sanitizes dangerous javascript: links by not rendering an active anchor tag', () => {
      const malicious = '[Attack](javascript:alert("XSS"))';
      const html = renderToStaticMarkup(<MarkdownRenderer content={malicious} />);
      expect(html).not.toContain('href="javascript:');
      expect(html).not.toContain('<a');
      expect(html).toContain('Attack');
    });

    it('sanitizes data: scheme links by not rendering an active anchor tag', () => {
      const malicious = '[Payload](data:text/html,<script>alert(1)</script>)';
      const html = renderToStaticMarkup(<MarkdownRenderer content={malicious} />);
      expect(html).not.toContain('<a');
      expect(html).toContain('Payload');
    });
  });

  describe('Blockquotes and Dividers', () => {
    it('renders blockquotes starting with >', () => {
      const markdown = '> Important notice about deprecation';
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<blockquote');
      expect(html).toContain('Important notice about deprecation');
    });

    it('renders horizontal rules with --- or ***', () => {
      const htmlHyphens = renderToStaticMarkup(<MarkdownRenderer content="---" />);
      expect(htmlHyphens).toContain('<hr');

      const htmlAsterisks = renderToStaticMarkup(<MarkdownRenderer content="***" />);
      expect(htmlAsterisks).toContain('<hr');
    });
  });

  describe('Robustness and Graceful Fallback', () => {
    it('handles empty string gracefully without throwing', () => {
      expect(() => renderToStaticMarkup(<MarkdownRenderer content="" />)).not.toThrow();
      const html = renderToStaticMarkup(<MarkdownRenderer content="" />);
      expect(html).toBe('<div></div>');
    });

    it('handles null or undefined gracefully without throwing', () => {
      expect(() => renderToStaticMarkup(<MarkdownRenderer content={null as any} />)).not.toThrow();
      expect(() => renderToStaticMarkup(<MarkdownRenderer content={undefined as any} />)).not.toThrow();
    });

    it('applies custom className prop to root element', () => {
      const html = renderToStaticMarkup(
        <MarkdownRenderer content="Simple text" className="custom-changelog-style" />
      );
      expect(html).toContain('custom-changelog-style');
    });

    it('renders multiple paragraphs separated by blank lines', () => {
      const markdown = `First paragraph text.\n\nSecond paragraph text.`;
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);
      expect(html).toContain('<p');
      expect(html).toContain('First paragraph text.');
      expect(html).toContain('Second paragraph text.');
    });
  });
});
