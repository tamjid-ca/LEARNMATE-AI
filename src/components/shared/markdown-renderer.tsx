'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type BlockNode =
  | { type: 'code'; language: string; code: string }
  | { type: 'math_block'; expr: string }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'paragraph'; text: string };

function CodeBlockCard({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 text-slate-100 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-medium text-slate-300">
        <span className="font-mono uppercase tracking-wide">{language || 'text'}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-300">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineSegments(text: string): React.ReactNode[] {
  // Match inline code (`...`), bold (**...**), italic (*...*), or inline math ($...$)
  const tokenRegex = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\$[^$\n]+\$)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `inl-${keyCounter++}`;
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key}
          className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[0.86em] text-[var(--foreground)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold text-[var(--foreground)]">
          {renderInlineSegments(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key} className="italic">
          {renderInlineSegments(token.slice(1, -1))}
        </em>,
      );
    } else if (token.startsWith('$') && token.endsWith('$')) {
      parts.push(
        <span
          key={key}
          className="mx-0.5 inline-block rounded bg-[var(--accent)]/60 px-1.5 py-0.2 font-mono text-[0.9em] italic text-[var(--accent-foreground)]"
        >
          {token.slice(1, -1)}
        </span>,
      );
    } else {
      parts.push(token);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdownBlocks(raw: string): BlockNode[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code blocks ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', language: lang, code: codeLines.join('\n') });
      continue;
    }

    // Display math blocks $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        blocks.push({ type: 'math_block', expr: trimmed.slice(2, -2).trim() });
        i += 1;
        continue;
      }
      const mathLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().endsWith('$$')) {
        mathLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) {
        const closing = lines[i]!.trim().replace(/\$\$$/, '').trim();
        if (closing) mathLines.push(closing);
        i += 1;
      }
      blocks.push({ type: 'math_block', expr: mathLines.join('\n').trim() });
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Headings # .. ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3 | 4;
      blocks.push({ type: 'heading', level, text: headingMatch[2]!.trim() });
      i += 1;
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // Tables
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1]!)) {
      const headers = splitTableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().includes('|')) {
        const rowText = lines[i]!.trim();
        if (!rowText) break;
        rows.push(splitTableCells(rowText));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph (consume contiguous lines until block boundary)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i]!;
      const curTrim = cur.trim();
      if (
        !curTrim ||
        curTrim.startsWith('```') ||
        curTrim.startsWith('$$') ||
        /^(#{1,4})\s+/.test(curTrim) ||
        curTrim.startsWith('>') ||
        /^(---|\*\*\*|___)$/.test(curTrim) ||
        /^[-*•]\s+/.test(curTrim) ||
        /^\d+[.)]\s+/.test(curTrim) ||
        (curTrim.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1]!))
      ) {
        break;
      }
      paraLines.push(curTrim);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(content || '');

  return (
    <div className={cn('space-y-3 text-[15px] leading-7 text-[var(--foreground)]', className)}>
      {blocks.map((block, index) => {
        const key = `blk-${index}`;
        switch (block.type) {
          case 'code':
            return <CodeBlockCard key={key} language={block.language} code={block.code} />;

          case 'math_block':
            return (
              <div
                key={key}
                className="my-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3 text-center font-mono text-sm italic text-[var(--foreground)]"
              >
                {block.expr}
              </div>
            );

          case 'hr':
            return <hr key={key} className="my-4 border-[var(--border)]" />;

          case 'heading': {
            const headingClasses: Record<1 | 2 | 3 | 4, string> = {
              1: 'mt-4 text-xl font-bold tracking-tight',
              2: 'mt-4 border-b border-[var(--border)]/70 pb-1.5 text-lg font-semibold tracking-tight',
              3: 'mt-3 text-base font-semibold',
              4: 'mt-2.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]',
            };
            const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
            return (
              <Tag key={key} className={headingClasses[block.level]}>
                {renderInlineSegments(block.text)}
              </Tag>
            );
          }

          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="my-2.5 rounded-r-xl border-l-4 border-[var(--primary)] bg-[var(--accent)]/40 px-4 py-2.5 text-sm leading-relaxed text-[var(--foreground)]"
              >
                {block.lines.map((l, idx) => (
                  <p key={idx}>{renderInlineSegments(l)}</p>
                ))}
              </blockquote>
            );

          case 'table':
            return (
              <div
                key={key}
                className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--muted)]/70 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      {block.headers.map((header, hIdx) => (
                        <th key={hIdx} className="border-b border-[var(--border)] px-3.5 py-2.5">
                          {renderInlineSegments(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--muted)]/30">
                        {block.headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2.5 align-top">
                            {renderInlineSegments(row[cIdx] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'ul':
            return (
              <ul key={key} className="my-2 ml-5 list-disc space-y-1.5 marker:text-[var(--primary)]">
                {block.items.map((item, idx) => (
                  <li key={idx} className="pl-1">
                    {renderInlineSegments(item)}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol
                key={key}
                className="my-2 ml-5 list-decimal space-y-1.5 marker:font-semibold marker:text-[var(--primary)]"
              >
                {block.items.map((item, idx) => (
                  <li key={idx} className="pl-1">
                    {renderInlineSegments(item)}
                  </li>
                ))}
              </ol>
            );

          case 'paragraph':
            return (
              <p key={key} className="text-[15px] leading-7">
                {renderInlineSegments(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
