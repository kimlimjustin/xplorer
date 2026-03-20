import type { SideBySideLine } from '@/lib/file-comparison';

// ── Language mapping (reused from CodePreview) ────────────────────────────
export const languageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  vue: 'markup',
  svelte: 'markup',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  ps1: 'powershell',
  dockerfile: 'docker',
  makefile: 'makefile',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  md: 'markdown',
  txt: 'text',
  log: 'text',
  csv: 'text',
};

export const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return languageMap[ext] || 'text';
};

// ── Minimal syntax-highlighting tokenizer ─────────────────────────────────
// We apply simple regex-based highlighting inline instead of pulling in
// react-syntax-highlighter (which cannot render per-line fragments easily).

export interface Token {
  text: string;
  color: string;
}

export const SYN_RULES: { lang: RegExp; rules: [RegExp, string][] }[] = [
  {
    // JS / TS / JSX / TSX
    lang: /^(javascript|jsx|typescript|tsx)$/,
    rules: [
      [/\/\/.*$/gm, 'var(--xp-green)'], // single-line comment
      [/\/\*[\s\S]*?\*\//g, 'var(--xp-green)'], // block comment
      [/(["'`])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'], // strings
      [
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|this|typeof|instanceof|switch|case|break|continue|throw|try|catch|finally|interface|type|enum|extends|implements|abstract|public|private|protected|static|readonly|declare|module|namespace|as|is|in|of|null|undefined|true|false|void|never|any|number|string|boolean|symbol|bigint)\b/g,
        'var(--xp-purple)',
      ],
      [/\b(\d+(\.\d+)?)\b/g, 'var(--xp-orange)'], // numbers
      [/[{}()[\];,.]/g, 'var(--xp-text-secondary)'], // punctuation
    ],
  },
  {
    // Python
    lang: /^python$/,
    rules: [
      [/#.*$/gm, 'var(--xp-green)'],
      [/("""[\s\S]*?"""|'''[\s\S]*?''')/g, 'var(--xp-yellow)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [
        /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|break|continue|lambda|yield|global|nonlocal|and|or|not|is|in|True|False|None|self|async|await)\b/g,
        'var(--xp-purple)',
      ],
      [/\b(\d+(\.\d+)?)\b/g, 'var(--xp-orange)'],
      [/@\w+/g, 'var(--xp-cyan)'],
    ],
  },
  {
    // Rust
    lang: /^rust$/,
    rules: [
      [/\/\/.*$/gm, 'var(--xp-green)'],
      [/\/\*[\s\S]*?\*\//g, 'var(--xp-green)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [
        /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|crate|self|super|return|if|else|for|while|loop|match|break|continue|async|await|move|where|type|as|in|ref|unsafe|static|extern|dyn|macro_rules|true|false)\b/g,
        'var(--xp-purple)',
      ],
      [/\b(\d+(\.\d+)?)\b/g, 'var(--xp-orange)'],
      [/#\[.*?\]/g, 'var(--xp-cyan)'],
    ],
  },
  {
    // Go
    lang: /^go$/,
    rules: [
      [/\/\/.*$/gm, 'var(--xp-green)'],
      [/\/\*[\s\S]*?\*\//g, 'var(--xp-green)'],
      [/(["'`])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [
        /\b(package|import|func|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|struct|interface|type|var|const|true|false|nil|iota)\b/g,
        'var(--xp-purple)',
      ],
      [/\b(\d+(\.\d+)?)\b/g, 'var(--xp-orange)'],
    ],
  },
  {
    // HTML / XML / markup
    lang: /^(html|xml|markup|svg)$/,
    rules: [
      [/<!--[\s\S]*?-->/g, 'var(--xp-green)'],
      [/<\/?[\w-]+/g, 'var(--xp-red)'],
      [/\b[\w-]+=/g, 'var(--xp-yellow)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-cyan)'],
      [/\/?>/g, 'var(--xp-red)'],
    ],
  },
  {
    // CSS / SCSS / LESS
    lang: /^(css|scss|less)$/,
    rules: [
      [/\/\*[\s\S]*?\*\//g, 'var(--xp-green)'],
      [/\/\/.*$/gm, 'var(--xp-green)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [/#[0-9a-fA-F]{3,8}\b/g, 'var(--xp-orange)'],
      [/\b(\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg|fr)?)\b/g, 'var(--xp-orange)'],
      [/[.#][\w-]+/g, 'var(--xp-cyan)'],
      [/@[\w-]+/g, 'var(--xp-purple)'],
      [/\$[\w-]+/g, 'var(--xp-purple)'],
    ],
  },
  {
    // JSON
    lang: /^json$/,
    rules: [
      [/"(?:[^"\\]|\\.)*"\s*:/g, 'var(--xp-cyan)'],
      [/"(?:[^"\\]|\\.)*"/g, 'var(--xp-yellow)'],
      [/\b(true|false|null)\b/g, 'var(--xp-purple)'],
      [/\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b/g, 'var(--xp-orange)'],
    ],
  },
  {
    // YAML
    lang: /^yaml$/,
    rules: [
      [/#.*$/gm, 'var(--xp-green)'],
      [/^[\w.-]+:/gm, 'var(--xp-cyan)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [/\b(true|false|null|yes|no)\b/gi, 'var(--xp-purple)'],
      [/\b-?\d+(\.\d+)?\b/g, 'var(--xp-orange)'],
    ],
  },
  {
    // SQL
    lang: /^sql$/,
    rules: [
      [/--.*$/gm, 'var(--xp-green)'],
      [/\/\*[\s\S]*?\*\//g, 'var(--xp-green)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [
        /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|SET|INTO|VALUES|EXISTS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|DEFAULT|CHECK|CONSTRAINT|UNIQUE|TRIGGER|FUNCTION|PROCEDURE|RETURN|RETURNS|DECLARE|IF|WHILE|LOOP|CURSOR|FETCH)\b/gi,
        'var(--xp-purple)',
      ],
      [/\b(\d+(\.\d+)?)\b/g, 'var(--xp-orange)'],
    ],
  },
  {
    // Bash / Shell
    lang: /^(bash|sh|shell)$/,
    rules: [
      [/#.*$/gm, 'var(--xp-green)'],
      [/(["'])(?:(?!\1|\\).|\\.)*?\1/g, 'var(--xp-yellow)'],
      [/\$[\w{]+}?/g, 'var(--xp-cyan)'],
      [
        /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|local|export|source|alias|unalias|cd|echo|printf|read|set|unset|shift|trap|eval|exec|test)\b/g,
        'var(--xp-purple)',
      ],
      [/\b(\d+)\b/g, 'var(--xp-orange)'],
    ],
  },
  {
    // Markdown
    lang: /^markdown$/,
    rules: [
      [/^#{1,6}\s+.*/gm, 'var(--xp-purple)'],
      [/\*\*.*?\*\*/g, 'var(--xp-yellow)'],
      [/\*.*?\*/g, 'var(--xp-cyan)'],
      [/`[^`]+`/g, 'var(--xp-orange)'],
      [/\[.*?\]\(.*?\)/g, 'var(--xp-cyan)'],
    ],
  },
];

/**
 * Tokenize a single line of code into colored fragments.
 * We collect all regex matches, sort by position, and fill gaps with
 * default-colored text.
 */
export const tokenizeLine = (text: string, language: string): Token[] => {
  if (!text) return [{ text: '', color: 'var(--xp-text)' }];

  const ruleSet = SYN_RULES.find((s) => s.lang.test(language));
  if (!ruleSet) return [{ text, color: 'var(--xp-text)' }];

  interface Match {
    start: number;
    end: number;
    color: string;
  }
  const matches: Match[] = [];

  for (const [regex, color] of ruleSet.rules) {
    // Clone to reset lastIndex
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      matches.push({ start: m.index, end: m.index + m[0].length, color });
    }
  }

  if (matches.length === 0) return [{ text, color: 'var(--xp-text)' }];

  // Sort by start, longer matches first for ties
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  // Remove overlapping matches (greedy first-match wins)
  const filtered: Match[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const tokens: Token[] = [];
  let pos = 0;
  for (const m of filtered) {
    if (m.start > pos) {
      tokens.push({ text: text.slice(pos, m.start), color: 'var(--xp-text)' });
    }
    tokens.push({ text: text.slice(m.start, m.end), color: m.color });
    pos = m.end;
  }
  if (pos < text.length) {
    tokens.push({ text: text.slice(pos), color: 'var(--xp-text)' });
  }
  return tokens;
};

// ── Hunk detection ────────────────────────────────────────────────────────
/** A "hunk" is a contiguous group of changed lines (added/removed). */
export interface DiffHunk {
  startIndex: number; // index into diffLines[]
  endIndex: number; // exclusive
}

export const detectHunks = (lines: SideBySideLine[]): DiffHunk[] => {
  const hunks: DiffHunk[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type !== 'unchanged') {
      const start = i;
      while (i < lines.length && lines[i].type !== 'unchanged') i++;
      hunks.push({ startIndex: start, endIndex: i });
    } else {
      i++;
    }
  }
  return hunks;
};

// ── Collapsible section grouping ──────────────────────────────────────────
// Collapse runs of unchanged lines longer than COLLAPSE_THRESHOLD, keeping
// CONTEXT_LINES visible above and below each changed section.
export const COLLAPSE_THRESHOLD = 8;
export const CONTEXT_LINES = 3;

export type DiffSegment =
  | { kind: 'lines'; lines: { line: SideBySideLine; originalIndex: number }[] }
  | { kind: 'collapsed'; lines: { line: SideBySideLine; originalIndex: number }[]; count: number };

export const buildSegments = (diffLines: SideBySideLine[]): DiffSegment[] => {
  // Tag each line with its original index
  const tagged = diffLines.map((line, i) => ({ line, originalIndex: i }));
  const segments: DiffSegment[] = [];

  let i = 0;
  while (i < tagged.length) {
    if (tagged[i].line.type !== 'unchanged') {
      // Emit changed lines directly
      const start = i;
      while (i < tagged.length && tagged[i].line.type !== 'unchanged') i++;
      segments.push({ kind: 'lines', lines: tagged.slice(start, i) });
    } else {
      // Collect run of unchanged lines
      const start = i;
      while (i < tagged.length && tagged[i].line.type === 'unchanged') i++;
      const run = tagged.slice(start, i);

      if (run.length > COLLAPSE_THRESHOLD) {
        // Keep context at top
        const topCtx = run.slice(0, CONTEXT_LINES);
        const bottomCtx = run.slice(run.length - CONTEXT_LINES);
        const middle = run.slice(CONTEXT_LINES, run.length - CONTEXT_LINES);

        if (topCtx.length > 0) segments.push({ kind: 'lines', lines: topCtx });
        if (middle.length > 0)
          segments.push({ kind: 'collapsed', lines: middle, count: middle.length });
        if (bottomCtx.length > 0) segments.push({ kind: 'lines', lines: bottomCtx });
      } else {
        segments.push({ kind: 'lines', lines: run });
      }
    }
  }
  return segments;
};

// ── Types ─────────────────────────────────────────────────────────────────
export type ViewMode = 'side-by-side' | 'unified';

export interface FileComparisonPageProps {
  file1Path: string;
  file2Path: string;
  onError?: (error: string) => void;
}
