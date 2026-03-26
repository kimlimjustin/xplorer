import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SoftwareEntry {
  id: string;
  name: string;
  keywords: string[];
  category: Category;
  icon: string;
  paths: PlatformPaths;
}

interface PlatformPaths {
  macos: string[];
  windows: string[];
  linux: string[];
}

type Category =
  | 'browsers'
  | 'development'
  | 'communication'
  | 'productivity'
  | 'media'
  | 'system';

type InstallStatus = 'checking' | 'installed' | 'not-found';

const CATEGORY_LABELS: Record<Category, string> = {
  browsers: 'Browsers',
  development: 'Development',
  communication: 'Communication',
  productivity: 'Productivity',
  media: 'Media',
  system: 'System & Utilities',
};

const CATEGORY_ICONS: Record<Category, string> = {
  browsers: '🌐',
  development: '🛠️',
  communication: '💬',
  productivity: '📋',
  media: '🎵',
  system: '⚙️',
};

/* ------------------------------------------------------------------ */
/*  Software catalog                                                   */
/* ------------------------------------------------------------------ */

const SOFTWARE_CATALOG: SoftwareEntry[] = [
  // ── Browsers ──
  {
    id: 'google-chrome',
    name: 'Google Chrome',
    keywords: ['chrome', 'google chrome', 'chromium'],
    category: 'browsers',
    icon: '🌐',
    paths: {
      macos: ['/Applications/Google Chrome.app'],
      windows: ['C:\\Program Files\\Google\\Chrome\\Application'],
      linux: ['/usr/bin/google-chrome', '/opt/google/chrome'],
    },
  },
  {
    id: 'firefox',
    name: 'Firefox',
    keywords: ['firefox', 'mozilla firefox', 'mozilla'],
    category: 'browsers',
    icon: '🦊',
    paths: {
      macos: ['/Applications/Firefox.app'],
      windows: ['C:\\Program Files\\Mozilla Firefox'],
      linux: ['/usr/bin/firefox', '/usr/lib/firefox'],
    },
  },
  {
    id: 'safari',
    name: 'Safari',
    keywords: ['safari', 'apple safari'],
    category: 'browsers',
    icon: '🧭',
    paths: {
      macos: ['/Applications/Safari.app'],
      windows: [],
      linux: [],
    },
  },
  {
    id: 'microsoft-edge',
    name: 'Microsoft Edge',
    keywords: ['edge', 'microsoft edge', 'msedge'],
    category: 'browsers',
    icon: '🌊',
    paths: {
      macos: ['/Applications/Microsoft Edge.app'],
      windows: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application'],
      linux: ['/usr/bin/microsoft-edge', '/opt/microsoft/msedge'],
    },
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    keywords: ['brave', 'brave browser'],
    category: 'browsers',
    icon: '🦁',
    paths: {
      macos: ['/Applications/Brave Browser.app'],
      windows: ['C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application'],
      linux: ['/usr/bin/brave-browser', '/opt/brave.com/brave'],
    },
  },
  {
    id: 'arc',
    name: 'Arc',
    keywords: ['arc', 'arc browser'],
    category: 'browsers',
    icon: '🌈',
    paths: {
      macos: ['/Applications/Arc.app'],
      windows: [],
      linux: [],
    },
  },
  {
    id: 'opera',
    name: 'Opera',
    keywords: ['opera', 'opera browser'],
    category: 'browsers',
    icon: '🔴',
    paths: {
      macos: ['/Applications/Opera.app'],
      windows: ['C:\\Program Files\\Opera'],
      linux: ['/usr/bin/opera', '/usr/lib/opera'],
    },
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    keywords: ['vivaldi', 'vivaldi browser'],
    category: 'browsers',
    icon: '🎵',
    paths: {
      macos: ['/Applications/Vivaldi.app'],
      windows: ['C:\\Program Files\\Vivaldi\\Application'],
      linux: ['/usr/bin/vivaldi', '/opt/vivaldi'],
    },
  },

  // ── Development ──
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    keywords: ['vscode', 'vs code', 'visual studio code', 'code'],
    category: 'development',
    icon: '💙',
    paths: {
      macos: ['/Applications/Visual Studio Code.app'],
      windows: ['C:\\Program Files\\Microsoft VS Code'],
      linux: ['/usr/bin/code', '/usr/share/code'],
    },
  },
  {
    id: 'xcode',
    name: 'Xcode',
    keywords: ['xcode', 'apple xcode', 'ios development'],
    category: 'development',
    icon: '🔨',
    paths: {
      macos: ['/Applications/Xcode.app'],
      windows: [],
      linux: [],
    },
  },
  {
    id: 'android-studio',
    name: 'Android Studio',
    keywords: ['android studio', 'android', 'jetbrains android'],
    category: 'development',
    icon: '🤖',
    paths: {
      macos: ['/Applications/Android Studio.app'],
      windows: ['C:\\Program Files\\Android\\Android Studio'],
      linux: ['/opt/android-studio', '/usr/local/android-studio'],
    },
  },
  {
    id: 'intellij-idea',
    name: 'IntelliJ IDEA',
    keywords: ['intellij', 'intellij idea', 'idea', 'jetbrains'],
    category: 'development',
    icon: '🧠',
    paths: {
      macos: [
        '/Applications/IntelliJ IDEA.app',
        '/Applications/IntelliJ IDEA CE.app',
      ],
      windows: ['C:\\Program Files\\JetBrains\\IntelliJ IDEA'],
      linux: ['/opt/idea', '/usr/local/idea'],
    },
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    keywords: ['pycharm', 'jetbrains pycharm', 'python ide'],
    category: 'development',
    icon: '🐍',
    paths: {
      macos: ['/Applications/PyCharm.app', '/Applications/PyCharm CE.app'],
      windows: ['C:\\Program Files\\JetBrains\\PyCharm'],
      linux: ['/opt/pycharm', '/usr/local/pycharm'],
    },
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    keywords: ['webstorm', 'jetbrains webstorm', 'javascript ide'],
    category: 'development',
    icon: '🕸️',
    paths: {
      macos: ['/Applications/WebStorm.app'],
      windows: ['C:\\Program Files\\JetBrains\\WebStorm'],
      linux: ['/opt/webstorm', '/usr/local/webstorm'],
    },
  },
  {
    id: 'sublime-text',
    name: 'Sublime Text',
    keywords: ['sublime', 'sublime text', 'subl'],
    category: 'development',
    icon: '📝',
    paths: {
      macos: ['/Applications/Sublime Text.app'],
      windows: ['C:\\Program Files\\Sublime Text'],
      linux: ['/usr/bin/subl', '/opt/sublime_text'],
    },
  },
  {
    id: 'iterm2',
    name: 'iTerm2',
    keywords: ['iterm', 'iterm2', 'terminal emulator'],
    category: 'development',
    icon: '⬛',
    paths: {
      macos: ['/Applications/iTerm.app'],
      windows: [],
      linux: [],
    },
  },
  {
    id: 'warp',
    name: 'Warp',
    keywords: ['warp', 'warp terminal'],
    category: 'development',
    icon: '🚀',
    paths: {
      macos: ['/Applications/Warp.app'],
      windows: [],
      linux: ['/usr/bin/warp-terminal'],
    },
  },
  {
    id: 'docker-desktop',
    name: 'Docker Desktop',
    keywords: ['docker', 'docker desktop', 'containers'],
    category: 'development',
    icon: '🐳',
    paths: {
      macos: ['/Applications/Docker.app'],
      windows: ['C:\\Program Files\\Docker\\Docker'],
      linux: ['/usr/bin/docker'],
    },
  },
  {
    id: 'postman',
    name: 'Postman',
    keywords: ['postman', 'api client', 'rest client'],
    category: 'development',
    icon: '📮',
    paths: {
      macos: ['/Applications/Postman.app'],
      windows: ['C:\\Program Files\\Postman'],
      linux: ['/usr/bin/postman', '/opt/Postman'],
    },
  },
  {
    id: 'git',
    name: 'Git',
    keywords: ['git', 'version control', 'scm'],
    category: 'development',
    icon: '🌿',
    paths: {
      macos: ['/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git'],
      windows: ['C:\\Program Files\\Git'],
      linux: ['/usr/bin/git'],
    },
  },
  {
    id: 'homebrew',
    name: 'Homebrew',
    keywords: ['homebrew', 'brew', 'package manager'],
    category: 'development',
    icon: '🍺',
    paths: {
      macos: ['/opt/homebrew', '/usr/local/Homebrew'],
      windows: [],
      linux: ['/home/linuxbrew/.linuxbrew'],
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    keywords: ['cursor', 'cursor editor', 'ai editor'],
    category: 'development',
    icon: '🖱️',
    paths: {
      macos: ['/Applications/Cursor.app'],
      windows: ['C:\\Program Files\\Cursor'],
      linux: ['/usr/bin/cursor', '/opt/cursor'],
    },
  },

  // ── Communication ──
  {
    id: 'slack',
    name: 'Slack',
    keywords: ['slack', 'slack app', 'workspace'],
    category: 'communication',
    icon: '💬',
    paths: {
      macos: ['/Applications/Slack.app'],
      windows: ['C:\\Program Files\\Slack'],
      linux: ['/usr/bin/slack', '/snap/bin/slack'],
    },
  },
  {
    id: 'discord',
    name: 'Discord',
    keywords: ['discord', 'gaming chat'],
    category: 'communication',
    icon: '🎮',
    paths: {
      macos: ['/Applications/Discord.app'],
      windows: ['C:\\Program Files\\Discord'],
      linux: ['/usr/bin/discord', '/snap/bin/discord'],
    },
  },
  {
    id: 'telegram',
    name: 'Telegram',
    keywords: ['telegram', 'tg', 'telegram desktop'],
    category: 'communication',
    icon: '✈️',
    paths: {
      macos: ['/Applications/Telegram.app', '/Applications/Telegram Desktop.app'],
      windows: ['C:\\Program Files\\Telegram Desktop'],
      linux: ['/usr/bin/telegram-desktop', '/snap/bin/telegram-desktop'],
    },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    keywords: ['whatsapp', 'whatsapp desktop', 'wa'],
    category: 'communication',
    icon: '💚',
    paths: {
      macos: ['/Applications/WhatsApp.app'],
      windows: ['C:\\Program Files\\WhatsApp'],
      linux: [],
    },
  },
  {
    id: 'zoom',
    name: 'Zoom',
    keywords: ['zoom', 'zoom meetings', 'video call'],
    category: 'communication',
    icon: '📹',
    paths: {
      macos: ['/Applications/zoom.us.app'],
      windows: ['C:\\Program Files\\Zoom'],
      linux: ['/usr/bin/zoom'],
    },
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    keywords: ['teams', 'microsoft teams', 'ms teams'],
    category: 'communication',
    icon: '🟣',
    paths: {
      macos: ['/Applications/Microsoft Teams.app'],
      windows: ['C:\\Program Files\\Microsoft\\Teams'],
      linux: ['/usr/bin/teams'],
    },
  },

  // ── Productivity ──
  {
    id: 'microsoft-word',
    name: 'Microsoft Word',
    keywords: ['word', 'microsoft word', 'ms word', 'docx'],
    category: 'productivity',
    icon: '📄',
    paths: {
      macos: ['/Applications/Microsoft Word.app'],
      windows: ['C:\\Program Files\\Microsoft Office\\root\\Office16'],
      linux: [],
    },
  },
  {
    id: 'microsoft-excel',
    name: 'Microsoft Excel',
    keywords: ['excel', 'microsoft excel', 'ms excel', 'xlsx', 'spreadsheet'],
    category: 'productivity',
    icon: '📊',
    paths: {
      macos: ['/Applications/Microsoft Excel.app'],
      windows: ['C:\\Program Files\\Microsoft Office\\root\\Office16'],
      linux: [],
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    keywords: ['notion', 'notion app', 'notes wiki'],
    category: 'productivity',
    icon: '📋',
    paths: {
      macos: ['/Applications/Notion.app'],
      windows: ['C:\\Program Files\\Notion'],
      linux: ['/usr/bin/notion-app', '/snap/bin/notion-snap'],
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    keywords: ['obsidian', 'obsidian md', 'markdown notes', 'pkm'],
    category: 'productivity',
    icon: '💜',
    paths: {
      macos: ['/Applications/Obsidian.app'],
      windows: ['C:\\Program Files\\Obsidian'],
      linux: ['/usr/bin/obsidian', '/snap/bin/obsidian'],
    },
  },
  {
    id: 'figma',
    name: 'Figma',
    keywords: ['figma', 'design', 'ui design', 'prototyping'],
    category: 'productivity',
    icon: '🎨',
    paths: {
      macos: ['/Applications/Figma.app'],
      windows: ['C:\\Program Files\\Figma'],
      linux: [],
    },
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    keywords: ['photoshop', 'adobe photoshop', 'ps', 'photo editing'],
    category: 'productivity',
    icon: '🖼️',
    paths: {
      macos: [
        '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app',
        '/Applications/Adobe Photoshop 2024/Adobe Photoshop 2024.app',
      ],
      windows: [
        'C:\\Program Files\\Adobe\\Adobe Photoshop 2025',
        'C:\\Program Files\\Adobe\\Adobe Photoshop 2024',
      ],
      linux: [],
    },
  },

  // ── Media ──
  {
    id: 'spotify',
    name: 'Spotify',
    keywords: ['spotify', 'music', 'streaming'],
    category: 'media',
    icon: '🎵',
    paths: {
      macos: ['/Applications/Spotify.app'],
      windows: ['C:\\Program Files\\Spotify'],
      linux: ['/usr/bin/spotify', '/snap/bin/spotify'],
    },
  },
  {
    id: 'vlc',
    name: 'VLC Media Player',
    keywords: ['vlc', 'vlc media player', 'videolan', 'video player'],
    category: 'media',
    icon: '🎞️',
    paths: {
      macos: ['/Applications/VLC.app'],
      windows: ['C:\\Program Files\\VideoLAN\\VLC'],
      linux: ['/usr/bin/vlc'],
    },
  },
  {
    id: 'iina',
    name: 'IINA',
    keywords: ['iina', 'media player', 'mpv', 'video'],
    category: 'media',
    icon: '▶️',
    paths: {
      macos: ['/Applications/IINA.app'],
      windows: [],
      linux: [],
    },
  },

  // ── System ──
  {
    id: 'terminal',
    name: 'Terminal',
    keywords: ['terminal', 'shell', 'console', 'bash', 'zsh'],
    category: 'system',
    icon: '🖥️',
    paths: {
      macos: ['/System/Applications/Utilities/Terminal.app'],
      windows: ['C:\\Windows\\System32'],
      linux: ['/usr/bin/gnome-terminal', '/usr/bin/xterm'],
    },
  },
  {
    id: 'activity-monitor',
    name: 'Activity Monitor',
    keywords: ['activity monitor', 'task manager', 'processes'],
    category: 'system',
    icon: '📈',
    paths: {
      macos: ['/System/Applications/Utilities/Activity Monitor.app'],
      windows: ['C:\\Windows\\System32'],
      linux: ['/usr/bin/gnome-system-monitor'],
    },
  },
  {
    id: 'system-settings',
    name: 'System Settings',
    keywords: ['system settings', 'system preferences', 'settings', 'preferences'],
    category: 'system',
    icon: '⚙️',
    paths: {
      macos: [
        '/System/Applications/System Settings.app',
        '/System/Applications/System Preferences.app',
      ],
      windows: ['C:\\Windows\\System32'],
      linux: ['/usr/bin/gnome-control-center'],
    },
  },
  {
    id: 'finder',
    name: 'Finder',
    keywords: ['finder', 'file manager', 'apple finder'],
    category: 'system',
    icon: '🗂️',
    paths: {
      macos: ['/System/Library/CoreServices/Finder.app'],
      windows: ['C:\\Windows\\explorer.exe'],
      linux: ['/usr/bin/nautilus', '/usr/bin/thunar', '/usr/bin/dolphin'],
    },
  },
  {
    id: 'disk-utility',
    name: 'Disk Utility',
    keywords: ['disk utility', 'disk management', 'disks', 'partition'],
    category: 'system',
    icon: '💿',
    paths: {
      macos: ['/System/Applications/Utilities/Disk Utility.app'],
      windows: ['C:\\Windows\\System32'],
      linux: ['/usr/bin/gnome-disks'],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Detect platform                                                    */
/* ------------------------------------------------------------------ */

const detectPlatform = (): 'macos' | 'windows' | 'linux' => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'var(--xp-font-family, system-ui, sans-serif)',
    fontSize: '13px',
    color: 'var(--xp-text, #cdd6f4)',
    background: 'var(--xp-bg-primary, #1e1e2e)',
  },
  searchContainer: {
    padding: '12px',
    borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.08))',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    background: 'var(--xp-bg-secondary, rgba(255,255,255,0.05))',
    color: 'var(--xp-text, #cdd6f4)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  category: {
    padding: '8px 12px 4px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--xp-text-muted, rgba(205,214,244,0.5))',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  appRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderRadius: '4px',
    margin: '1px 4px',
  },
  appIcon: {
    fontSize: '18px',
    width: '24px',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  appInfo: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    fontWeight: 500,
    color: 'var(--xp-text, #cdd6f4)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  appPath: {
    fontSize: '11px',
    color: 'var(--xp-text-muted, rgba(205,214,244,0.4))',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '1px',
  },
  statusDot: (status: InstallStatus) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    background:
      status === 'installed'
        ? 'var(--xp-success, #a6e3a1)'
        : status === 'checking'
          ? 'var(--xp-warning, #f9e2af)'
          : 'var(--xp-text-muted, rgba(205,214,244,0.2))',
  }),
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--xp-text-muted, rgba(205,214,244,0.4))',
    gap: '8px',
    padding: '24px',
    textAlign: 'center' as const,
  },
  countBadge: {
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '8px',
    background: 'var(--xp-bg-secondary, rgba(255,255,255,0.08))',
    color: 'var(--xp-text-muted, rgba(205,214,244,0.5))',
    marginLeft: 'auto',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

let api: XplorerAPI;

const SoftwareFinderPanel = () => {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, InstallStatus>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const platform = useMemo(detectPlatform, []);

  const getPaths = useCallback(
    (entry: SoftwareEntry): string[] => entry.paths[platform],
    [platform],
  );

  // Check installation status for all apps on mount
  useEffect(() => {
    const checkAll = async () => {
      const initial: Record<string, InstallStatus> = {};
      for (const entry of SOFTWARE_CATALOG) {
        initial[entry.id] = 'checking';
      }
      setStatuses(initial);

      const BATCH_SIZE = 10;
      for (let i = 0; i < SOFTWARE_CATALOG.length; i += BATCH_SIZE) {
        const batch = SOFTWARE_CATALOG.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (entry) => {
            const paths = entry.paths[platform];
            for (const p of paths) {
              try {
                const exists = await api.files.exists(p);
                if (exists) return { id: entry.id, status: 'installed' as const, path: p };
              } catch {
                // path check failed, continue
              }
            }
            return { id: entry.id, status: 'not-found' as const, path: null };
          }),
        );
        setStatuses((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.id] = r.status;
          }
          return next;
        });
      }
    };
    checkAll();
  }, [platform]);

  // Filter by search query
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SOFTWARE_CATALOG;
    return SOFTWARE_CATALOG.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.keywords.some((k) => k.includes(q)) ||
        e.category.includes(q),
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Partial<Record<Category, SoftwareEntry[]>> = {};
    for (const entry of filtered) {
      if (!groups[entry.category]) groups[entry.category] = [];
      groups[entry.category]!.push(entry);
    }
    return groups;
  }, [filtered]);

  const handleClick = useCallback(
    (entry: SoftwareEntry) => {
      const paths = getPaths(entry);
      for (const p of paths) {
        if (statuses[entry.id] === 'installed') {
          // Navigate to the parent directory for .app bundles / exe files
          const isBundle = p.endsWith('.app') || p.endsWith('.exe');
          const target = isBundle ? p.split(/[/\\]/).slice(0, -1).join('/') : p;
          api.navigation.navigateTo(target);
          return;
        }
      }
      // If not installed, navigate to first candidate path's parent
      if (paths.length > 0) {
        const parent = paths[0].split(/[/\\]/).slice(0, -1).join('/');
        api.navigation.navigateTo(parent);
      }
    },
    [statuses, getPaths],
  );

  const categoryOrder: Category[] = [
    'browsers',
    'development',
    'communication',
    'productivity',
    'media',
    'system',
  ];

  if (filtered.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.searchContainer}>
          <input
            style={styles.searchInput}
            placeholder="Search software..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={styles.emptyState}>
          <span style={{ fontSize: '32px' }}>🔍</span>
          <span>No software found for "{query}"</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchContainer}>
        <input
          style={styles.searchInput}
          placeholder="Search software... (e.g. chrome, vscode)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div style={styles.scrollArea}>
        {categoryOrder.map((cat) => {
          const entries = grouped[cat];
          if (!entries || entries.length === 0) return null;
          const installedCount = entries.filter(
            (e) => statuses[e.id] === 'installed',
          ).length;
          return (
            <div key={cat}>
              <div style={styles.category}>
                <span>{CATEGORY_ICONS[cat]}</span>
                <span>{CATEGORY_LABELS[cat]}</span>
                <span style={styles.countBadge}>
                  {installedCount}/{entries.length}
                </span>
              </div>
              {entries.map((entry) => {
                const paths = getPaths(entry);
                const displayPath =
                  paths.length > 0 ? paths[0] : 'Not available on this platform';
                const status = statuses[entry.id] ?? 'checking';
                const isHovered = hoveredId === entry.id;
                return (
                  <div
                    key={entry.id}
                    style={{
                      ...styles.appRow,
                      background: isHovered
                        ? 'var(--xp-bg-hover, rgba(255,255,255,0.06))'
                        : 'transparent',
                    }}
                    onClick={() => handleClick(entry)}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    title={`${entry.name}\n${displayPath}`}
                  >
                    <span style={styles.appIcon}>{entry.icon}</span>
                    <div style={styles.appInfo}>
                      <div style={styles.appName}>{entry.name}</div>
                      <div style={styles.appPath}>{displayPath}</div>
                    </div>
                    <div style={styles.statusDot(status)} title={status} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Register                                                           */
/* ------------------------------------------------------------------ */

Sidebar.register({
  id: 'xplorer-software-finder',
  title: 'Software Finder',
  description: 'Find installation paths of popular software',
  icon: 'search',
  permissions: ['file:read', 'directory:list', 'ui:panels'],
  onActivate: (injectedApi) => {
    api = injectedApi;
  },
  render: () => <SoftwareFinderPanel />,
});
