import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer. Handles:
 * - Headers (# ## ###)
 * - Bold (**text**)
 * - Italic (_text_ or single *text* — but not inside words)
 * - Inline code (`code`)
 * - Code blocks (```lang ... ```)
 * - Bullet lists (- or *)
 * - Numbered lists (1. 2.)
 * - Links [text](url)
 * - Horizontal rules (---)
 * - Blockquotes (> text)
 * - Tables (| col | col |)
 */
const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  const elements = parseMarkdown(content);
  return (
    <div
      className={`markdown-content ${className}`}
      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0, overflow: 'hidden' }}
    >
      {elements}
    </div>
  );
}

const parseMarkdown = (text: string) : React.ReactNode[] => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={key++}
          className="bg-xp-bg border border-xp-border rounded-md p-3 my-2 overflow-x-auto text-xs"
        >
          <code className="text-xp-text">{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      elements.push(<hr key={key++} className="border-xp-border my-3" />);
      i++;
      continue;
    }

    // Table: detect a row of | cells | followed by a separator line |---|---|
    if (/^\|(.+)\|/.test(line) && i + 1 < lines.length && /^\|[\s:]*-+/.test(lines[i + 1])) {
      const tableRows: string[][] = [];
      const headerCells = parseTableRow(line);
      tableRows.push(headerCells);

      // Parse alignment from separator row
      const sepLine = lines[i + 1];
      const alignments = parseTableAlignments(sepLine);
      i += 2;

      // Parse body rows
      while (i < lines.length && /^\|(.+)\|/.test(lines[i])) {
        tableRows.push(parseTableRow(lines[i]));
        i++;
      }

      elements.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-xp-border">
            <thead>
              <tr className="bg-xp-bg">
                {tableRows[0].map((cell, ci) => (
                  <th
                    key={ci}
                    className="px-2 py-1.5 border border-xp-border text-left font-semibold"
                    style={{ textAlign: alignments[ci] || 'left' }}
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-xp-bg/30'}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1 border border-xp-border"
                      style={{ textAlign: alignments[ci] || 'left' }}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      const sizes: Record<number, string> = {
        1: 'text-base font-bold mt-3 mb-1',
        2: 'text-sm font-bold mt-2 mb-1',
        3: 'text-sm font-semibold mt-2 mb-1',
      };
      elements.push(
        <Tag key={key++} className={sizes[level] || sizes[3]}>
          {renderInline(text)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="border-l-2 border-xp-border-light pl-3 my-2 text-xp-text-muted"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi}>{renderInline(ql)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside my-1 space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside my-1 space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-0.5 text-sm leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return elements;
}

/** Parse a markdown table row into cells */
const parseTableRow = (line: string) : string[] => {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Parse table alignment from separator row (e.g. |:---|:---:|---:| ) */
const parseTableAlignments = (sepLine: string) : ('left' | 'center' | 'right')[] => {
  return sepLine
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((seg) => {
      const s = seg.trim();
      const left = s.startsWith(':');
      const right = s.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    });
}

/**
 * Render inline markdown: bold, italic, code, links
 */
const renderInline = (text: string): React.ReactNode => {
  // Regex pattern order matters — process code first to avoid interfering with ** inside code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let segKey = 0;

  while (remaining.length > 0) {
    // Inline code `...`
    let match = remaining.match(/^(.*?)`([^`]+)`([\s\S]*)/);
    if (match) {
      if (match[1]) parts.push(...renderBoldItalic(match[1], segKey++));
      parts.push(
        <code
          key={`c-${segKey++}`}
          className="bg-xp-bg text-xp-purple px-1 py-0.5 rounded text-xs break-all"
        >
          {match[2]}
        </code>,
      );
      remaining = match[3];
      continue;
    }

    // Link [text](url)
    match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)/);
    if (match) {
      if (match[1]) parts.push(...renderBoldItalic(match[1], segKey++));
      const href = match[3];
      const isValidUrl = /^(https?:\/\/|mailto:|#|\/)/i.test(href);
      if (isValidUrl) {
        parts.push(
          <a
            key={`a-${segKey++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xp-blue underline break-all"
          >
            {match[2]}
          </a>,
        );
      } else {
        // Render as plain text instead of a link for unsafe URLs
        parts.push(
          <span key={`a-${segKey++}`} className="text-xp-blue">
            {match[2]}
          </span>,
        );
      }
      remaining = match[4];
      continue;
    }

    // No more special inline patterns — process bold/italic on the rest
    parts.push(...renderBoldItalic(remaining, segKey));
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
};

const renderBoldItalic = (text: string, keyBase: number) : React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    // Bold **...**
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*([\s\S]*)/);
    if (match) {
      if (match[1]) parts.push(<span key={`t-${keyBase}-${k++}`}>{match[1]}</span>);
      parts.push(
        <strong key={`b-${keyBase}-${k++}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
      remaining = match[3];
      continue;
    }

    // Bold __...__
    match = remaining.match(/^(.*?)__(.+?)__([\s\S]*)/);
    if (match) {
      if (match[1]) parts.push(<span key={`t-${keyBase}-${k++}`}>{match[1]}</span>);
      parts.push(
        <strong key={`b-${keyBase}-${k++}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
      remaining = match[3];
      continue;
    }

    // Italic _..._ (not inside words)
    match = remaining.match(/^(.*?)(?:^|\s)_([^_]+)_(?:\s|$|[.,;:!?])([\s\S]*)/);
    if (match) {
      if (match[1]) parts.push(<span key={`t-${keyBase}-${k++}`}>{match[1]} </span>);
      parts.push(
        <em key={`i-${keyBase}-${k++}`} className="italic">
          {match[2]}
        </em>,
      );
      remaining = match[3] ? ' ' + match[3] : '';
      continue;
    }

    // No more matches
    if (remaining) {
      parts.push(<span key={`t-${keyBase}-${k}`}>{remaining}</span>);
    }
    break;
  }

  return parts;
}

export default MarkdownRenderer;
