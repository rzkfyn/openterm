import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { tauriApi } from '../../services/tauri';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0c0c14]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-gray-400 select-none">
        <span className="font-mono text-gray-400 text-[11px]">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
};

const handleOpenUrl = (url: string) => {
  tauriApi.openUrl(url).catch(() => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
};

interface TokenMatch {
  type: 'code' | 'link' | 'boldItalic' | 'bold' | 'italic' | 'bareUrl';
  index: number;
  length: number;
  content: string;
  extra?: string;
}

function findEarliestMatch(str: string): TokenMatch | null {
  const matches: TokenMatch[] = [];

  // 1. Inline code: `code`
  const codeMatch = /`([^`\n]+)`/.exec(str);
  if (codeMatch && codeMatch.index !== undefined) {
    matches.push({
      type: 'code',
      index: codeMatch.index,
      length: codeMatch[0].length,
      content: codeMatch[1],
    });
  }

  // 2. Link: [text](url)
  const linkMatch = /\[([^\]\n]*)\]\(([^)\s]+)\)/.exec(str);
  if (linkMatch && linkMatch.index !== undefined) {
    matches.push({
      type: 'link',
      index: linkMatch.index,
      length: linkMatch[0].length,
      content: linkMatch[1],
      extra: linkMatch[2],
    });
  }

  // 3. Bold + Italic: ***text*** or ___text___
  const biMatch =
    /(?:(?<!\*)\*\*\*(?!\*)([^\n]+?)(?<!\*)\*\*\*(?!\*)|(?<!_)___(?!_)([^\n]+?)(?<!_)___(?!_))/.exec(
      str
    );
  if (biMatch && biMatch.index !== undefined) {
    matches.push({
      type: 'boldItalic',
      index: biMatch.index,
      length: biMatch[0].length,
      content: biMatch[1] || biMatch[2] || '',
    });
  }

  // 4. Bold: **text** or __text__
  const boldMatch =
    /(?:(?<!\*)\*\*(?!\*)([^\n]+?)(?<!\*)\*\*(?!\*)|(?<!_)__(?!_)([^\n]+?)(?<!_)__(?!_))/.exec(
      str
    );
  if (boldMatch && boldMatch.index !== undefined) {
    matches.push({
      type: 'bold',
      index: boldMatch.index,
      length: boldMatch[0].length,
      content: boldMatch[1] || boldMatch[2] || '',
    });
  }

  // 5. Italic: *text* or _text_
  const italicMatch =
    /(?:(?<!\*)\*(?!\*)([^\n]+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)([^\n]+?)(?<!_)_(?!_))/.exec(
      str
    );
  if (italicMatch && italicMatch.index !== undefined) {
    matches.push({
      type: 'italic',
      index: italicMatch.index,
      length: italicMatch[0].length,
      content: italicMatch[1] || italicMatch[2] || '',
    });
  }

  // 6. Bare URL: https://... or http://...
  const bareUrlMatch = /(https?:\/\/[^\s<>)"]+)/.exec(str);
  if (bareUrlMatch && bareUrlMatch.index !== undefined) {
    matches.push({
      type: 'bareUrl',
      index: bareUrlMatch.index,
      length: bareUrlMatch[0].length,
      content: bareUrlMatch[1],
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.length - a.length;
  });

  return matches[0];
}

function parseInline(text: string, depth = 0): React.ReactNode[] {
  if (!text) return [];
  if (depth > 5) return [text];

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const match = findEarliestMatch(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }

    const key = `inline-${depth}-${keyIndex++}-${match.type}`;

    switch (match.type) {
      case 'code':
        nodes.push(
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-indigo-200"
          >
            {match.content}
          </code>
        );
        break;

      case 'link': {
        const url = match.extra || '';
        if (isSafeUrl(url)) {
          nodes.push(
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                handleOpenUrl(url);
              }}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {parseInline(match.content, depth + 1)}
            </a>
          );
        } else {
          nodes.push(
            <span key={key} className="text-gray-400">
              {parseInline(match.content, depth + 1)}
            </span>
          );
        }
        break;
      }

      case 'bareUrl': {
        const rawUrl = match.content;
        const cleanUrl = rawUrl.replace(/[.,;:!?]+$/, '');
        const trailing = rawUrl.slice(cleanUrl.length);
        if (isSafeUrl(cleanUrl)) {
          nodes.push(
            <a
              key={key}
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                handleOpenUrl(cleanUrl);
              }}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {cleanUrl}
            </a>
          );
        } else {
          nodes.push(cleanUrl);
        }
        if (trailing) {
          nodes.push(trailing);
        }
        break;
      }

      case 'boldItalic':
        nodes.push(
          <strong key={key}>
            <em>{parseInline(match.content, depth + 1)}</em>
          </strong>
        );
        break;

      case 'bold':
        nodes.push(
          <strong key={key}>
            {parseInline(match.content, depth + 1)}
          </strong>
        );
        break;

      case 'italic':
        nodes.push(
          <em key={key}>
            {parseInline(match.content, depth + 1)}
          </em>
        );
        break;
    }

    remaining = remaining.slice(match.index + match.length);
  }

  return nodes;
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'ul'; items: { text: string; indent: number }[] }
  | { type: 'ol'; items: { text: string; indent: number }[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const UL_REGEX = /^(\s*)[-*]\s+(.*)$/;
const OL_REGEX = /^(\s*)\d+\.\s+(.*)$/;
const BQ_REGEX = /^>\s?(.*)$/;
const HR_REGEX = /^(?:---|\*\*\*|___)\s*$/;

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks
    if (line.startsWith('```')) {
      const langMatch = line.match(/^```(\w*)/);
      const language = langMatch ? langMatch[1] : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'codeblock', language, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // 2. Empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 3. Horizontal rules
    if (HR_REGEX.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 4. Headings
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // 5. Blockquotes
    if (BQ_REGEX.test(line)) {
      const bqLines: string[] = [];
      while (i < lines.length && BQ_REGEX.test(lines[i])) {
        const match = lines[i].match(BQ_REGEX)!;
        bqLines.push(match[1]);
        i++;
      }
      blocks.push({ type: 'blockquote', text: bqLines.join(' ') });
      continue;
    }

    // 6. Unordered lists
    if (UL_REGEX.test(line)) {
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length && UL_REGEX.test(lines[i])) {
        const match = lines[i].match(UL_REGEX)!;
        items.push({ indent: match[1].length, text: match[2] });
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 7. Ordered lists
    if (OL_REGEX.test(line)) {
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length && OL_REGEX.test(lines[i])) {
        const match = lines[i].match(OL_REGEX)!;
        items.push({ indent: match[1].length, text: match[2] });
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 8. Paragraphs
    const pLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      if (
        lines[i].startsWith('```') ||
        HEADING_REGEX.test(lines[i]) ||
        HR_REGEX.test(lines[i].trim()) ||
        BQ_REGEX.test(lines[i]) ||
        UL_REGEX.test(lines[i]) ||
        OL_REGEX.test(lines[i])
      ) {
        break;
      }
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({ type: 'paragraph', text: pLines.join(' ') });
    }
  }

  return blocks;
}

function renderBlock(block: Block, index: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const content = parseInline(block.text);
      switch (block.level) {
        case 1:
          return (
            <h1
              key={index}
              className="text-xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10"
            >
              {content}
            </h1>
          );
        case 2:
          return (
            <h2
              key={index}
              className="text-lg font-semibold text-white mt-3 mb-1.5 pb-0.5 border-b border-white/5"
            >
              {content}
            </h2>
          );
        case 3:
          return (
            <h3
              key={index}
              className="text-base font-semibold text-gray-100 mt-2.5 mb-1"
            >
              {content}
            </h3>
          );
        case 4:
          return (
            <h4
              key={index}
              className="text-sm font-semibold text-gray-200 mt-2 mb-1"
            >
              {content}
            </h4>
          );
        case 5:
          return (
            <h5
              key={index}
              className="text-xs font-semibold uppercase tracking-wider text-gray-300 mt-2 mb-1"
            >
              {content}
            </h5>
          );
        default:
          return (
            <h6
              key={index}
              className="text-xs font-medium uppercase tracking-wider text-gray-400 mt-2 mb-1"
            >
              {content}
            </h6>
          );
      }
    }

    case 'codeblock':
      return <CodeBlock key={index} code={block.code} language={block.language} />;

    case 'ul':
      return (
        <ul
          key={index}
          className="list-disc list-inside space-y-1 my-2 text-sm text-gray-300"
        >
          {block.items.map((item, itIdx) => (
            <li
              key={itIdx}
              style={item.indent > 0 ? { marginLeft: `${item.indent * 0.75}rem` } : undefined}
            >
              {parseInline(item.text)}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol
          key={index}
          className="list-decimal list-inside space-y-1 my-2 text-sm text-gray-300"
        >
          {block.items.map((item, itIdx) => (
            <li
              key={itIdx}
              style={item.indent > 0 ? { marginLeft: `${item.indent * 0.75}rem` } : undefined}
            >
              {parseInline(item.text)}
            </li>
          ))}
        </ol>
      );

    case 'blockquote':
      return (
        <blockquote
          key={index}
          className="border-l-4 border-indigo-500/60 pl-3 py-1 my-2 bg-white/[0.03] rounded-r text-sm text-gray-300 italic leading-relaxed"
        >
          {parseInline(block.text)}
        </blockquote>
      );

    case 'hr':
      return <hr key={index} className="border-white/10 my-4" />;

    case 'paragraph':
      return (
        <p key={index} className="my-1.5 text-sm text-gray-300 leading-relaxed">
          {parseInline(block.text)}
        </p>
      );
  }
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
}) => {
  if (!content || typeof content !== 'string') {
    return <div className={className || undefined} />;
  }

  const blocks = parseBlocks(content);

  const containerClasses = className ? `space-y-1 ${className}` : 'space-y-1';

  return (
    <div className={containerClasses}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
};
