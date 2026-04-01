/**
 * Problems Panel Extension for Xplorer
 *
 * Directory diagnostics with customizable problem detection rules.
 * Scans the current directory for common issues (empty files, broken
 * symlinks, naming convention violations, large files, junk files)
 * and displays them in a filterable bottom panel tab.
 *
 * Users can enable/disable individual rules and adjust thresholds
 * via an inline configuration UI.
 */
import {
  BottomTab,
  Command,
  type XplorerAPI,
} from '@xplorer/extension-sdk';

const React = (window as any).React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ── Interfaces ──────────────────────────────────────────────────────

interface DirectoryProblem {
  path: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  size?: number;
}

interface DiagnosisResult {
  problems: DirectoryProblem[];
  scanned_files: number;
  scanned_dirs: number;
}

interface ProblemRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  enabled: boolean;
  /** Regex pattern for naming rules */
  pattern?: string;
  /** Max file size in bytes for large file rules */
  maxSize?: number;
}

// ── Default Rules ───────────────────────────────────────────────────

const DEFAULT_RULES: ProblemRule[] = [
  {
    id: 'empty-files',
    name: 'Empty Files',
    description: 'Detect files with zero bytes',
    severity: 'warning',
    category: 'empty',
    enabled: true,
  },
  {
    id: 'broken-symlinks',
    name: 'Broken Symlinks',
    description: 'Detect symbolic links pointing to non-existent targets',
    severity: 'error',
    category: 'broken',
    enabled: true,
  },
  {
    id: 'naming-spaces',
    name: 'Spaces in Names',
    description: 'Detect files/folders with leading or trailing spaces',
    severity: 'warning',
    category: 'naming',
    enabled: true,
    pattern: '^\\s|\\s$',
  },
  {
    id: 'naming-special-chars',
    name: 'Special Characters',
    description: 'Detect filenames with potentially problematic characters',
    severity: 'info',
    category: 'naming',
    enabled: true,
    pattern: '[<>:"|?*]',
  },
  {
    id: 'large-files-100mb',
    name: 'Very Large Files (>100 MB)',
    description: 'Flag files larger than 100 MB',
    severity: 'warning',
    category: 'large',
    enabled: true,
    maxSize: 104857600,
  },
  {
    id: 'large-files-1gb',
    name: 'Huge Files (>1 GB)',
    description: 'Flag files larger than 1 GB',
    severity: 'error',
    category: 'large',
    enabled: true,
    maxSize: 1073741824,
  },
  {
    id: 'junk-files',
    name: 'Junk / Temp Files',
    description: 'Detect common temporary and junk files (Thumbs.db, .DS_Store, desktop.ini)',
    severity: 'info',
    category: 'junk',
    enabled: true,
  },
  {
    id: 'permission-issues',
    name: 'Permission Issues',
    description: 'Detect files with unusual or restrictive permissions',
    severity: 'warning',
    category: 'permission',
    enabled: true,
  },
];

const STORAGE_KEY_RULES = 'problem-rules';

// ── Inline Styles ───────────────────────────────────────────────────

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'var(--xp-font, inherit)',
    fontSize: 12,
    color: 'var(--xp-text)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    borderBottom: '1px solid var(--xp-border)',
    background: 'rgba(var(--xp-surface-light-rgb, 255,255,255), 0.03)',
    flexShrink: 0,
  },
  filterBtn: (active: boolean) => ({
    padding: '2px 8px',
    fontSize: 10,
    borderRadius: 3,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: active ? 'rgba(var(--xp-blue-rgb, 122,162,247), 0.2)' : 'transparent',
    color: active ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
  }),
  toggleBtn: (active: boolean) => ({
    padding: '2px 8px',
    fontSize: 10,
    borderRadius: 3,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: active ? 'rgba(var(--xp-blue-rgb, 122,162,247), 0.2)' : 'transparent',
    color: active ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
  }),
  separator: {
    width: 1,
    height: 16,
    background: 'var(--xp-border)',
    margin: '0 4px',
  },
  flex1: { flex: 1 },
  scanStats: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    whiteSpace: 'nowrap' as const,
  },
  iconBtn: {
    padding: '2px 8px',
    fontSize: 10,
    borderRadius: 3,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: 'var(--xp-text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  table: {
    width: '100%',
    fontSize: 12,
    borderCollapse: 'collapse' as const,
  },
  row: {
    cursor: 'pointer',
    borderBottom: '1px solid rgba(var(--xp-border-rgb, 255,255,255), 0.1)',
  },
  cellSeverity: {
    paddingLeft: 12,
    paddingTop: 4,
    paddingBottom: 4,
    width: 20,
  },
  cellMessage: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    color: 'var(--xp-text)',
    whiteSpace: 'nowrap' as const,
  },
  cellName: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    color: 'var(--xp-text-muted)',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cellSize: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    color: 'var(--xp-text-muted)',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  cellPath: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingRight: 12,
    color: 'var(--xp-text-muted)',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'right' as const,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: 12,
    color: 'var(--xp-text-muted)',
    gap: 8,
  },
  // ── Configure Rules UI ────────────────────────────────────────────
  configOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'var(--xp-bg)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--xp-border)',
    fontWeight: 600,
    fontSize: 12,
  },
  configList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid rgba(var(--xp-border-rgb, 255,255,255), 0.05)',
  },
  ruleToggle: (enabled: boolean) => ({
    width: 32,
    height: 16,
    borderRadius: 8,
    background: enabled ? 'var(--xp-blue)' : 'var(--xp-surface-light, #333)',
    position: 'relative' as const,
    cursor: 'pointer',
    flexShrink: 0,
    border: 'none',
    padding: 0,
    transition: 'background 0.15s',
  }),
  ruleToggleKnob: (enabled: boolean) => ({
    position: 'absolute' as const,
    top: 2,
    left: enabled ? 16 : 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.15s',
  }),
  ruleInfo: {
    flex: 1,
    minWidth: 0,
  },
  ruleName: {
    fontWeight: 500,
    fontSize: 12,
    color: 'var(--xp-text)',
  },
  ruleDescription: {
    fontSize: 10,
    color: 'var(--xp-text-muted)',
    marginTop: 1,
  },
  ruleSeverity: (sev: string) => ({
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 3,
    flexShrink: 0,
    background:
      sev === 'error'
        ? 'rgba(248,113,113,0.15)'
        : sev === 'warning'
          ? 'rgba(251,191,36,0.15)'
          : 'rgba(96,165,250,0.15)',
    color:
      sev === 'error'
        ? '#f87171'
        : sev === 'warning'
          ? '#fbbf24'
          : '#60a5fa',
  }),
};

// ── SVG Icons ───────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  const size = 14;
  switch (severity) {
    case 'error':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="#f87171" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="8" />
        </svg>
      );
    case 'warning':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="#fbbf24" style={{ flexShrink: 0 }}>
          <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495z" />
        </svg>
      );
    case 'info':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="#60a5fa" style={{ flexShrink: 0 }}>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return null;
  }
}

function CategoryIcon({ category }: { category: string }) {
  const size = 13;
  const s: React.CSSProperties = { display: 'inline-block', verticalAlign: 'middle', marginRight: 4 };
  switch (category) {
    case 'empty':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <rect width="16" height="13" x="4" y="8" rx="2" />
          <path d="m22 8-4-4H6L2 8" />
        </svg>
      );
    case 'large':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
        </svg>
      );
    case 'broken':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" />
          <line x1="8" x2="16" y1="12" y2="12" />
        </svg>
      );
    case 'naming':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
        </svg>
      );
    case 'permission':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'junk':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
        </svg>
      );
  }
}

function SpinnerIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" fill="#4ade80">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ── Rules Config Panel ──────────────────────────────────────────────

function RulesConfigPanel({
  rules,
  onToggleRule,
  onClose,
}: {
  rules: ProblemRule[];
  onToggleRule: (ruleId: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={S.configOverlay}>
      <div style={S.configHeader}>
        <span>Configure Problem Detection Rules</span>
        <button
          onClick={onClose}
          style={{ ...S.iconBtn, padding: '4px 8px' }}
          title="Close configuration"
        >
          <CloseIcon />
        </button>
      </div>
      <div style={S.configList}>
        {rules.map((rule) => (
          <div key={rule.id} style={S.ruleRow}>
            <button
              style={S.ruleToggle(rule.enabled)}
              onClick={() => onToggleRule(rule.id)}
              title={rule.enabled ? 'Disable rule' : 'Enable rule'}
              aria-label={`${rule.enabled ? 'Disable' : 'Enable'} rule: ${rule.name}`}
            >
              <div style={S.ruleToggleKnob(rule.enabled)} />
            </button>
            <div style={S.ruleInfo}>
              <div style={S.ruleName}>{rule.name}</div>
              <div style={S.ruleDescription}>
                {rule.description}
                {rule.maxSize != null && ` (threshold: ${formatSize(rule.maxSize)})`}
                {rule.pattern != null && ` (pattern: ${rule.pattern})`}
              </div>
            </div>
            <span style={S.ruleSeverity(rule.severity)}>{rule.severity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel Component ────────────────────────────────────────────

function ProblemsPanel({
  api,
  currentPath,
}: {
  api: XplorerAPI;
  currentPath?: string;
}) {
  const [problems, setProblems] = useState<DirectoryProblem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStats, setScanStats] = useState<{ files: number; dirs: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [skipHidden, setSkipHidden] = useState(true);
  const [skipGitignored, setSkipGitignored] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [rules, setRules] = useState<ProblemRule[]>(DEFAULT_RULES);
  const lastScannedPath = useRef<string>('');
  const lastOptionsRef = useRef({ skipHidden: true, skipGitignored: true });
  const rulesLoaded = useRef(false);

  // Load saved rules from extension storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await (api as any).storage.get(STORAGE_KEY_RULES);
        if (saved && Array.isArray(saved)) {
          // Merge saved rules with defaults (in case new defaults were added)
          const merged = DEFAULT_RULES.map((def) => {
            const savedRule = (saved as ProblemRule[]).find((r) => r.id === def.id);
            return savedRule ? { ...def, enabled: savedRule.enabled } : def;
          });
          setRules(merged);
        }
      } catch {
        // Ignore -- use defaults
      }
      rulesLoaded.current = true;
    })();
  }, [api]);

  // Save rules when they change (but not on initial load)
  useEffect(() => {
    if (!rulesLoaded.current) return;
    (api as any).storage.set(STORAGE_KEY_RULES, rules).catch(() => {});
  }, [rules, api]);

  const toggleRule = useCallback((ruleId: string) => {
    setRules((prev: ProblemRule[]) =>
      prev.map((r: ProblemRule) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
    );
  }, []);

  const enabledCategories = useMemo(() => {
    const cats = new Set<string>();
    rules.filter((r: ProblemRule) => r.enabled).forEach((r: ProblemRule) => cats.add(r.category));
    return cats;
  }, [rules]);

  const runDiagnosis = useCallback(
    async (path: string, hidden = skipHidden, gitignored = skipGitignored) => {
      if (
        !path ||
        path.startsWith('xplorer://') ||
        path.startsWith('gdrive://') ||
        path.startsWith('comparison://')
      ) {
        setProblems([]);
        setScanStats(null);
        return;
      }
      setScanning(true);
      try {
        const result: DiagnosisResult = await (api as any).diagnostics.diagnoseDirectory(
          path,
          hidden,
          gitignored,
        );
        // Filter results by enabled rules
        const filtered = result.problems.filter((p: DirectoryProblem) =>
          enabledCategories.has(p.category),
        );
        setProblems(filtered);
        setScanStats({ files: result.scanned_files, dirs: result.scanned_dirs });
        lastScannedPath.current = path;
        lastOptionsRef.current = { skipHidden: hidden, skipGitignored: gitignored };
      } catch {
        setProblems([]);
        setScanStats(null);
      } finally {
        setScanning(false);
      }
    },
    [skipHidden, skipGitignored, api, enabledCategories],
  );

  // Auto-scan when currentPath changes
  useEffect(() => {
    if (currentPath && currentPath !== lastScannedPath.current) {
      runDiagnosis(currentPath);
    }
  }, [currentPath, runDiagnosis]);

  // Re-scan when rules change (if we already scanned this path)
  useEffect(() => {
    if (rulesLoaded.current && lastScannedPath.current) {
      runDiagnosis(lastScannedPath.current);
    }
  }, [enabledCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorCount = problems.filter((p: DirectoryProblem) => p.severity === 'error').length;
  const warningCount = problems.filter((p: DirectoryProblem) => p.severity === 'warning').length;
  const infoCount = problems.filter((p: DirectoryProblem) => p.severity === 'info').length;

  const filteredProblems =
    filter === 'all' ? problems : problems.filter((p: DirectoryProblem) => p.severity === filter);

  const handleProblemClick = (problem: DirectoryProblem) => {
    // Navigate to the parent folder of the problem file
    const sep = problem.path.includes('/') ? '/' : '\\';
    const parts = problem.path.split(sep);
    parts.pop();
    const parentDir = parts.join(sep);
    if (parentDir) {
      api.navigation.navigateTo(parentDir);
    }
  };

  const basePath = currentPath || '';

  return (
    <div style={{ ...S.container, position: 'relative' }}>
      {/* Inject CSS keyframes for spinner animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Problems toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(['all', 'error', 'warning', 'info'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={S.filterBtn(filter === f)}
            >
              {f === 'all'
                ? `All (${problems.length})`
                : f === 'error'
                  ? `Errors (${errorCount})`
                  : f === 'warning'
                    ? `Warnings (${warningCount})`
                    : `Info (${infoCount})`}
            </button>
          ))}
        </div>
        <div style={S.separator} />
        <button
          onClick={() => {
            const nv = !skipHidden;
            setSkipHidden(nv);
            if (currentPath) runDiagnosis(currentPath, nv, skipGitignored);
          }}
          style={S.toggleBtn(!skipHidden)}
          title={skipHidden ? 'Hidden files excluded -- click to include' : 'Hidden files included -- click to exclude'}
        >
          Hidden
        </button>
        <button
          onClick={() => {
            const nv = !skipGitignored;
            setSkipGitignored(nv);
            if (currentPath) runDiagnosis(currentPath, skipHidden, nv);
          }}
          style={S.toggleBtn(!skipGitignored)}
          title={skipGitignored ? '.gitignore respected -- click to include ignored files' : 'Ignored files included -- click to respect .gitignore'}
        >
          .gitignore
        </button>
        <div style={S.flex1} />
        {scanStats && (
          <span style={S.scanStats}>
            Scanned {scanStats.files} files, {scanStats.dirs} dirs
          </span>
        )}
        <button
          onClick={() => setShowConfig(true)}
          style={S.iconBtn}
          title="Configure problem detection rules"
        >
          <SettingsIcon />
        </button>
        <button
          onClick={() => currentPath && runDiagnosis(currentPath)}
          disabled={scanning}
          style={{ ...S.iconBtn, opacity: scanning ? 0.5 : 1 }}
          title="Re-scan directory"
        >
          {scanning ? <SpinnerIcon /> : <RefreshIcon />}
        </button>
      </div>

      {/* Problems list */}
      <div style={S.listContainer}>
        {scanning && problems.length === 0 ? (
          <div style={S.emptyState}>
            <SpinnerIcon size={16} />
            Scanning directory...
          </div>
        ) : filteredProblems.length === 0 ? (
          <div style={S.emptyState}>
            <CheckIcon />
            {filter === 'all' ? 'No problems detected' : `No ${filter}s found`}
          </div>
        ) : (
          <table style={S.table}>
            <tbody>
              {filteredProblems.map((problem: DirectoryProblem, i: number) => (
                <tr
                  key={`${problem.path}-${i}`}
                  style={S.row}
                  onClick={() => handleProblemClick(problem)}
                  title={problem.path}
                  onMouseOver={(e: any) => {
                    e.currentTarget.style.background = 'rgba(var(--xp-surface-light-rgb, 255,255,255), 0.05)';
                  }}
                  onMouseOut={(e: any) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={S.cellSeverity}>
                    <SeverityIcon severity={problem.severity} />
                  </td>
                  <td style={S.cellMessage}>
                    <CategoryIcon category={problem.category} />
                    {problem.message}
                  </td>
                  <td style={S.cellName} title={problem.name}>
                    {problem.name}
                  </td>
                  <td style={S.cellSize}>
                    {problem.size != null ? formatSize(problem.size) : ''}
                  </td>
                  <td style={S.cellPath} title={problem.path}>
                    {problem.path.replace(basePath, '.').replace(/\\/g, '/')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rules configuration overlay */}
      {showConfig && (
        <RulesConfigPanel
          rules={rules}
          onToggleRule={toggleRule}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

// ── Registration ────────────────────────────────────────────────────

let problemsApi: XplorerAPI;

BottomTab.register({
  id: 'problems',
  title: 'PROBLEMS',
  icon: 'alert-triangle',
  permissions: ['files:read', 'storage:read', 'storage:write'],
  render: (props) => <ProblemsPanel api={problemsApi} currentPath={props.currentPath} />,
  onActivate: (api) => {
    problemsApi = api;
  },
});

Command.register({
  id: 'problems-open',
  title: 'Problems: Open Panel',
  action: (_api) => {
    window.dispatchEvent(
      new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'problems' } }),
    );
  },
});

Command.register({
  id: 'problems-scan',
  title: 'Problems: Scan Current Directory',
  action: (_api) => {
    window.dispatchEvent(
      new CustomEvent('xplorer-set-bottom-tab', { detail: { tab: 'problems' } }),
    );
  },
});
