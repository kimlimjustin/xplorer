import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TauriAPI } from '@/lib/tauri-api';
import type { PtyOutputPayload } from '@/lib/tauri-api/pty';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';

import '@xterm/xterm/css/xterm.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface TermTab {
  id: string;
  label: string;
  terminal: Terminal;
  fitAddon: FitAddon;
}

interface XTermPanelProps {
  cwd: string;
  collapsed?: boolean;
}

// ── Theme helper ─────────────────────────────────────────────────────────────

const getCssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

const getTermTheme = () => ({
  background: getCssVar('--xp-bg', '#1a1b26'),
  foreground: getCssVar('--xp-text', '#c0caf5'),
  cursor: getCssVar('--xp-blue', '#7aa2f7'),
  cursorAccent: getCssVar('--xp-bg', '#1a1b26'),
  selectionBackground: 'rgba(122, 162, 247, 0.3)',
  black: '#15161e',
  red: getCssVar('--xp-red', '#f7768e'),
  green: getCssVar('--xp-green', '#9ece6a'),
  yellow: getCssVar('--xp-orange', '#e0af68'),
  blue: getCssVar('--xp-blue', '#7aa2f7'),
  magenta: getCssVar('--xp-pink', '#bb9af7'),
  cyan: getCssVar('--xp-cyan', '#7dcfff'),
  white: getCssVar('--xp-text', '#c0caf5'),
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
});

// ── Single terminal instance ─────────────────────────────────────────────────

const TermInstance = ({ tab, cwd, isActive }: { tab: TermTab; cwd: string; isActive: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const spawnedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    tab.terminal.open(containerRef.current);
    tab.fitAddon.fit();

    return () => {
      tab.terminal.dispose();
    };
  }, [tab]);

  useEffect(() => {
    if (!isActive) return;
    requestAnimationFrame(() => {
      tab.fitAddon.fit();
      tab.terminal.focus();
    });
  }, [isActive, tab]);

  useEffect(() => {
    if (spawnedRef.current) return;
    spawnedRef.current = true;

    const cols = tab.terminal.cols || 80;
    const rows = tab.terminal.rows || 24;

    TauriAPI.ptySpawn(tab.id, cwd, cols, rows).catch((err) => {
      console.error(`[XTerm] Failed to spawn PTY ${tab.id}:`, err);
      tab.terminal.writeln(`\r\nFailed to start terminal: ${err}`);
    });

    tab.terminal.onData((data) => {
      TauriAPI.ptyWrite(tab.id, data).catch(() => {});
    });

    return () => {
      TauriAPI.ptyKill(tab.id).catch(() => {});
    };
  }, [tab, cwd]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      try {
        tab.fitAddon.fit();
        TauriAPI.ptyResize(tab.id, tab.terminal.cols, tab.terminal.rows).catch(() => {});
      } catch {
        /* ignore */
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isActive, tab]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
      }}
    />
  );
};

// ── Multi-tab panel ──────────────────────────────────────────────────────────

let tabCounter = 0;

const createTab = (): TermTab => {
  tabCounter++;
  const id = `pty-${Date.now()}-${tabCounter}`;
  const theme = getTermTheme();
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
    lineHeight: 1.3,
    theme,
    allowProposedApi: true,
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  return { id, label: `Terminal ${tabCounter}`, terminal, fitAddon };
};

const XTermPanel = ({ cwd, collapsed }: XTermPanelProps) => {
  const [tabs, setTabs] = useState<TermTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id || '');

  // Listen to PTY output — route to correct terminal
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    TauriAPI.listenToPtyOutput((payload: PtyOutputPayload) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === payload.session_id);
        if (tab) tab.terminal.write(payload.data);
        return prev;
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // Listen to PTY exit — mark tab as exited
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    TauriAPI.listenToPtyExit((sessionId: string) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === sessionId);
        if (tab) tab.terminal.writeln('\r\n[Process exited]');
        return prev;
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // Update theme when CSS variables change (theme switch)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = getTermTheme();
      tabs.forEach((tab) => {
        tab.terminal.options.theme = theme;
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, [tabs]);

  const handleAddTab = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      TauriAPI.ptyKill(id).catch(() => {});
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const tab = createTab();
          setActiveTabId(tab.id);
          return [tab];
        }
        if (id === activeTabId) {
          setActiveTabId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  if (collapsed) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: getCssVar('--xp-bg', '#1a1b26'),
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          minHeight: 32,
          borderBottom: `1px solid ${getCssVar('--xp-border', 'rgba(41,46,66,0.5)')}`,
          backgroundColor: getCssVar('--xp-surface', 'rgba(26,27,38,0.8)'),
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flex: 1, overflow: 'auto', gap: 1 }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                height: 32,
                fontSize: 11,
                cursor: 'pointer',
                color:
                  tab.id === activeTabId
                    ? getCssVar('--xp-text', '#c0caf5')
                    : getCssVar('--xp-text-muted', '#565f89'),
                backgroundColor:
                  tab.id === activeTabId ? getCssVar('--xp-bg', '#1a1b26') : 'transparent',
                borderBottom:
                  tab.id === activeTabId
                    ? `1px solid ${getCssVar('--xp-blue', '#7aa2f7')}`
                    : '1px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'all 0.1s',
              }}
            >
              <TerminalIcon size={12} />
              <span>{tab.label}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    opacity: 0.5,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.5';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add tab button */}
        <button
          onClick={handleAddTab}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            marginRight: 4,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: getCssVar('--xp-text-muted', '#565f89'),
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="New Terminal"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Terminal instances */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map((tab) => (
          <TermInstance key={tab.id} tab={tab} cwd={cwd} isActive={tab.id === activeTabId} />
        ))}
      </div>
    </div>
  );
};

export default XTermPanel;
