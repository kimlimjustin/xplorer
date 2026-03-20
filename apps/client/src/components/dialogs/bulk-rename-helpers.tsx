import React from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Preset {
  label: string;
  description: string;
  pattern: string;
  replacement: string;
}

export interface PatternTemplate {
  label: string;
  icon: string;
  apply: (filename: string) => string;
  description: string;
}

export interface RegexSnippet {
  label: string;
  pattern: string;
  description: string;
}

export interface DiffSpan {
  text: string;
  type: 'same' | 'added' | 'removed';
}

// ── Presets / Constants ──────────────────────────────────────────────────────

export const PRESETS: Preset[] = [
  {
    label: 'Add prefix',
    description: 'Add text before filename',
    pattern: '^(.+)$',
    replacement: 'prefix_$1',
  },
  {
    label: 'Add suffix',
    description: 'Add text before extension',
    pattern: '^(.+)(\\.[^.]+)$',
    replacement: '$1_suffix$2',
  },
  {
    label: 'Replace text',
    description: 'Find and replace in filename',
    pattern: 'find',
    replacement: 'replace',
  },
  {
    label: 'Sequential numbering',
    description: 'Rename to prefix_001, prefix_002...',
    pattern: '^.*$',
    replacement: 'file_{N}',
  },
];

// ── Case Conversion Helpers ──────────────────────────────────────────────────

export const toCamelCase = (str: string): string => {
  const parts = str
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(/\s+/);
  if (parts.length === 0) return str;
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join('')
  );
};

export const toSnakeCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

export const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

// ── Pattern Templates ────────────────────────────────────────────────────────

export const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    label: 'camelCase',
    icon: 'Aa',
    description: 'Convert filename to camelCase',
    apply: (filename: string) => {
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) return toCamelCase(filename);
      const name = filename.substring(0, dot);
      const ext = filename.substring(dot);
      return toCamelCase(name) + ext;
    },
  },
  {
    label: 'snake_case',
    icon: 'a_b',
    description: 'Convert filename to snake_case',
    apply: (filename: string) => {
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) return toSnakeCase(filename);
      const name = filename.substring(0, dot);
      const ext = filename.substring(dot);
      return toSnakeCase(name) + ext;
    },
  },
  {
    label: 'kebab-case',
    icon: 'a-b',
    description: 'Convert filename to kebab-case',
    apply: (filename: string) => {
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) return toKebabCase(filename);
      const name = filename.substring(0, dot);
      const ext = filename.substring(dot);
      return toKebabCase(name) + ext;
    },
  },
  {
    label: 'UPPERCASE',
    icon: 'AB',
    description: 'Convert filename to UPPERCASE',
    apply: (filename: string) => {
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) return filename.toUpperCase();
      const name = filename.substring(0, dot);
      const ext = filename.substring(dot);
      return name.toUpperCase() + ext;
    },
  },
  {
    label: 'lowercase',
    icon: 'ab',
    description: 'Convert filename to lowercase',
    apply: (filename: string) => {
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) return filename.toLowerCase();
      const name = filename.substring(0, dot);
      const ext = filename.substring(dot);
      return name.toLowerCase() + ext;
    },
  },
  {
    label: 'Add Date Prefix',
    icon: 'D+',
    description: 'Prepend YYYY-MM-DD to filename',
    apply: (filename: string) => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}_${filename}`;
    },
  },
  {
    label: 'Remove Spaces',
    icon: '_',
    description: 'Replace spaces with underscores',
    apply: (filename: string) => filename.replace(/\s+/g, '_'),
  },
];

// ── Regex Snippets ───────────────────────────────────────────────────────────

export const REGEX_SNIPPETS: RegexSnippet[] = [
  { label: '(.*)', pattern: '(.*)', description: 'Capture everything' },
  { label: '(.+)', pattern: '(.+)', description: 'Capture one or more chars' },
  { label: '\\d+', pattern: '\\d+', description: 'One or more digits' },
  { label: '\\w+', pattern: '\\w+', description: 'Word characters' },
  { label: '\\s', pattern: '\\s', description: 'Whitespace character' },
  { label: '^', pattern: '^', description: 'Start of string' },
  { label: '$', pattern: '$', description: 'End of string' },
  { label: '\\.', pattern: '\\.', description: 'Literal dot' },
  { label: '[^.]+', pattern: '[^.]+', description: 'Non-dot characters' },
  { label: '(\\.[^.]+)$', pattern: '(\\.[^.]+)$', description: 'File extension' },
  { label: '(.+?)(?=\\.)', pattern: '(.+?)(?=\\.)', description: 'Name before first dot' },
  { label: '[A-Z]', pattern: '[A-Z]', description: 'Uppercase letter' },
];

// ── Diff Highlighting ────────────────────────────────────────────────────────

/** Compute the longest common subsequence lengths table */
const lcsTable = (a: string, b: string): number[][] => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
};

/** Produce diff spans comparing old string to new string */
export const diffStrings = (
  oldStr: string,
  newStr: string,
): { oldSpans: DiffSpan[]; newSpans: DiffSpan[] } => {
  if (oldStr === newStr) {
    return {
      oldSpans: [{ text: oldStr, type: 'same' }],
      newSpans: [{ text: newStr, type: 'same' }],
    };
  }

  const dp = lcsTable(oldStr, newStr);

  let i = oldStr.length;
  let j = newStr.length;
  const oldChars: { ch: string; matched: boolean }[] = [];
  const newChars: { ch: string; matched: boolean }[] = [];

  // Backtrack through LCS to mark matched characters
  while (i > 0 && j > 0) {
    if (oldStr[i - 1] === newStr[j - 1]) {
      oldChars.unshift({ ch: oldStr[i - 1], matched: true });
      newChars.unshift({ ch: newStr[j - 1], matched: true });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      oldChars.unshift({ ch: oldStr[i - 1], matched: false });
      i--;
    } else {
      newChars.unshift({ ch: newStr[j - 1], matched: false });
      j--;
    }
  }
  while (i > 0) {
    oldChars.unshift({ ch: oldStr[i - 1], matched: false });
    i--;
  }
  while (j > 0) {
    newChars.unshift({ ch: newStr[j - 1], matched: false });
    j--;
  }

  // Group consecutive chars with same match status into spans
  const groupSpans = (
    chars: { ch: string; matched: boolean }[],
    unmatchedType: 'added' | 'removed',
  ): DiffSpan[] => {
    const spans: DiffSpan[] = [];
    let current = '';
    let currentType: 'same' | 'added' | 'removed' | null = null;
    for (const { ch, matched } of chars) {
      const type = matched ? 'same' : unmatchedType;
      if (type === currentType) {
        current += ch;
      } else {
        if (current) spans.push({ text: current, type: currentType! });
        current = ch;
        currentType = type;
      }
    }
    if (current) spans.push({ text: current, type: currentType! });
    return spans;
  };

  return {
    oldSpans: groupSpans(oldChars, 'removed'),
    newSpans: groupSpans(newChars, 'added'),
  };
};

// ── Sub-Components ───────────────────────────────────────────────────────────

export const DiffText = ({ spans }: { spans: DiffSpan[] }) => {
  return (
    <span>
      {spans.map((span, i) => {
        if (span.type === 'same') {
          return <span key={i}>{span.text}</span>;
        }
        if (span.type === 'removed') {
          return (
            <span
              key={i}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                color: 'var(--xp-red)',
                textDecoration: 'line-through',
                borderRadius: 2,
                padding: '0 1px',
              }}
            >
              {span.text}
            </span>
          );
        }
        // added
        return (
          <span
            key={i}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.25)',
              color: 'var(--xp-green)',
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {span.text}
          </span>
        );
      })}
    </span>
  );
};

export const WarningIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M8 1L15 14H1L8 1Z"
        fill="var(--xp-orange)"
        fillOpacity="0.2"
        stroke="var(--xp-orange)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="8"
        y="12.5"
        textAnchor="middle"
        fill="var(--xp-orange)"
        fontSize="9"
        fontWeight="bold"
      >
        !
      </text>
    </svg>
  );
};

export const CheckIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="var(--xp-green)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const ChevronIcon = ({ open }: { open: boolean }) => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        transition: 'transform 0.2s',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <path
        d="M5 3L9 7L5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
