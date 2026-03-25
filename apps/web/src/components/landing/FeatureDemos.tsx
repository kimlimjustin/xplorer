'use client';

import React, { useState } from 'react';

// ── Real Xplorer client components ──────────────────────────────────────────
import LeftSidebar from '@client/components/explorer/LeftSidebar';
import OperationBar from '@client/components/explorer/OperationBar';
import FileGridItem from '@client/components/explorer/FileGridItem';
import StatusBar from '@client/components/StatusBar';
import TopBar from '@client/components/explorer/TopBar';
import NavigationBar from '@client/components/explorer/NavigationBar';

// ── Utils & types from the mock layer ───────────────────────────────────────
import type { FileEntry, FileTag } from '@/lib/tauri-api';
import { getFileIcon, formatFileSize, formatFolderSize } from '@/lib/utils';
import {
  LayoutGrid, List, Grid3X3, Table,
  ArrowDownAZ, Calendar, HardDrive, Tag,
  BarChart3, Pencil, Puzzle, ShoppingCart, Settings,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
 *  Demo data — static files used to populate the real components
 * ═══════════════════════════════════════════════════════════════════════════ */

const DEMO_PATH = 'C:\\Users\\User\\Projects\\xplorer';

const DEMO_FILES: FileEntry[] = [
  { name: 'src', path: `${DEMO_PATH}\\src`, is_dir: true, size: 0, modified: Date.now() / 1000 - 86400, file_type: 'directory' },
  { name: 'public', path: `${DEMO_PATH}\\public`, is_dir: true, size: 0, modified: Date.now() / 1000 - 172800, file_type: 'directory' },
  { name: 'node_modules', path: `${DEMO_PATH}\\node_modules`, is_dir: true, size: 0, modified: Date.now() / 1000 - 259200, file_type: 'directory' },
  { name: 'package.json', path: `${DEMO_PATH}\\package.json`, is_dir: false, size: 2100, modified: Date.now() / 1000 - 3600, file_type: 'json' },
  { name: 'tsconfig.json', path: `${DEMO_PATH}\\tsconfig.json`, is_dir: false, size: 845, modified: Date.now() / 1000 - 604800, file_type: 'json' },
  { name: 'README.md', path: `${DEMO_PATH}\\README.md`, is_dir: false, size: 4300, modified: Date.now() / 1000 - 172800, file_type: 'md' },
  { name: 'vite.config.ts', path: `${DEMO_PATH}\\vite.config.ts`, is_dir: false, size: 1200, modified: Date.now() / 1000 - 43200, file_type: 'ts' },
  { name: '.gitignore', path: `${DEMO_PATH}\\.gitignore`, is_dir: false, size: 312, modified: Date.now() / 1000 - 2592000, file_type: 'text' },
  { name: 'index.html', path: `${DEMO_PATH}\\index.html`, is_dir: false, size: 1800, modified: Date.now() / 1000 - 1209600, file_type: 'html' },
  { name: 'hero.png', path: `${DEMO_PATH}\\hero.png`, is_dir: false, size: 2457600, modified: Date.now() / 1000 - 259200, file_type: 'png' },
  { name: 'styles.css', path: `${DEMO_PATH}\\styles.css`, is_dir: false, size: 5600, modified: Date.now() / 1000 - 7200, file_type: 'css' },
  { name: '.env.local', path: `${DEMO_PATH}\\.env.local`, is_dir: false, size: 128, modified: Date.now() / 1000 - 2592000, file_type: 'text' },
];

const DEMO_TAGS: Record<string, FileTag[]> = {
  [`${DEMO_PATH}\\package.json`]: [{ name: 'important', color: '#6366f1' }],
  [`${DEMO_PATH}\\README.md`]: [{ name: 'docs', color: '#34d399' }],
};

const DEMO_GIT_STATUS: Record<string, string> = {
  [`${DEMO_PATH}\\src`]: 'modified',
  [`${DEMO_PATH}\\package.json`]: 'modified',
  [`${DEMO_PATH}\\vite.config.ts`]: 'modified',
};

const SORT_OPTIONS: Record<string, { id: string; name: string; icon: React.ReactNode }> = {
  name: { id: 'name', name: 'Name', icon: <ArrowDownAZ size={13} /> },
  dateModified: { id: 'dateModified', name: 'Date', icon: <Calendar size={13} /> },
  size: { id: 'size', name: 'Size', icon: <HardDrive size={13} /> },
  type: { id: 'type', name: 'Type', icon: <Tag size={13} /> },
};

const VIEW_MODES: Record<string, { id: string; name: string; icon: React.ReactNode }> = {
  grid: { id: 'grid', name: 'Grid', icon: <LayoutGrid size={13} /> },
  list: { id: 'list', name: 'List', icon: <List size={13} /> },
  details: { id: 'details', name: 'Details', icon: <Table size={13} /> },
  'small-grid': { id: 'small-grid', name: 'Small Grid', icon: <Grid3X3 size={13} /> },
};

function demoFormatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  1. FileBrowserDemo — Real LeftSidebar + TopBar + OperationBar +
 *     FileGridItem + StatusBar composed and scaled to fit the demo card
 * ═══════════════════════════════════════════════════════════════════════════ */

const DEMO_TABS = [
  { id: '1', name: 'xplorer', path: DEMO_PATH, type: 'folder' as const },
  { id: '2', name: 'package.json', path: `${DEMO_PATH}\\package.json`, type: 'file' as const },
  { id: '3', name: 'README.md', path: `${DEMO_PATH}\\README.md`, type: 'file' as const },
];

export function FileBrowserDemo({ compact }: { compact?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set([DEMO_FILES[3].path]));
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isGridView = viewMode === 'grid' || viewMode === 'small-grid';
  const isListView = viewMode === 'list';
  const itemSize = isListView ? 'w-4 h-4' : isGridView ? 'w-8 h-8' : 'w-5 h-5';

  const scale = compact ? 0.55 : 0.85;
  const inverse = `${(100 / scale).toFixed(1)}%`;

  return (
    <div className="xp-theme h-full w-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #1a0a2e 50%, #0a1a2e 75%, #0a0a1a 100%)' }}>
      <div className="h-full w-full flex flex-col" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: inverse, height: inverse }}>
        {/* Real TopBar with tabs, nav buttons, split controls */}
        <TopBar
          leftSidebarCollapsed={false}
          setLeftSidebarCollapsed={() => {}}
          currentPath={DEMO_PATH}
          tabs={DEMO_TABS}
          activeTabId="1"
          onSwitchTab={() => {}}
          onCloseTab={() => {}}
          navigateBackInHistory={() => {}}
          navigateForwardInHistory={() => {}}
          canNavigateBackInHistory={() => true}
          canNavigateForwardInHistory={() => false}
          navigateUp={() => {}}
          refetch={() => {}}
          onAddTab={() => {}}
          onSplitRight={() => {}}
          onSplitDown={() => {}}
        />

        <div className="flex flex-1 min-h-0">
          {/* Real LeftSidebar component */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <LeftSidebar
            currentPath={DEMO_PATH}
            files={DEMO_FILES}
            navigateToPath={() => {}}
            handleFileClick={() => {}}
            getFileIcon={getFileIcon as any}
            sortBy={sortBy}
            sortOrder={sortOrder}
            width={200}
          />

          {/* Main area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Real NavigationBar with breadcrumb path */}
            <NavigationBar currentPath={DEMO_PATH} />
            {/* Real OperationBar component */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <OperationBar
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewModes={VIEW_MODES as any}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              toggleSortOrder={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              sortOptions={SORT_OPTIONS as any}
              handleCreateFolder={() => {}}
              handleDelete={() => {}}
              selectedFiles={selected}
              setBottomPanelCollapsed={() => {}}
              setBottomPanelTab={() => {}}
            />

            {/* File grid using real FileGridItem components */}
            <div className={`flex-1 overflow-hidden p-2 ${
              isGridView
                ? 'grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1 content-start'
                : 'space-y-0.5'
            }`}>
              {DEMO_FILES.map(file => (
                <FileGridItem
                  key={file.path}
                  file={file}
                  isSelected={selected.has(file.path)}
                  tags={DEMO_TAGS[file.path] || []}
                  gitStatus={DEMO_GIT_STATUS[file.path] || null}
                  isGridView={isGridView}
                  isListView={isListView}
                  viewMode={viewMode}
                  itemSize={itemSize}
                  selectedFiles={selected}
                  allFiles={DEMO_FILES}
                  getFileIcon={getFileIcon as any}
                  formatFileSize={formatFileSize}
                  formatFolderSize={formatFolderSize as any}
                  formatDate={demoFormatDate}
                  onFileClick={(f) => setSelected(new Set([f.path]))}
                  onFileDoubleClick={() => {}}
                  onFileRightClick={() => {}}
                  getFolderSize={() => null}
                  isCalculatingSize={() => false}
                />
              ))}
            </div>

            {/* Real StatusBar component */}
            <StatusBar
              files={DEMO_FILES}
              selectedFiles={selected}
              currentPath={DEMO_PATH}
            />
          </div>

          {/* Vertical extensions icon strip */}
          <div className="w-10 bg-xp-surface border-l border-xp-border flex flex-col items-center py-2 gap-1 shrink-0">
            {[Eye, Search, BarChart3, FileText, Pencil, Puzzle, ShoppingCart].map((Icon, i) => (
              <button key={i} className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${i === 0 ? 'bg-xp-blue text-white' : 'text-xp-text-muted hover:bg-xp-surface-light'}`}>
                <Icon size={16} />
              </button>
            ))}
            <div className="flex-1" />
            <div className="border-t border-xp-border pt-2 w-full flex justify-center">
              <button className="w-8 h-8 rounded flex items-center justify-center text-xp-text-muted hover:bg-xp-surface-light">
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  2–6. Real Xplorer panel components with fake demo data
 * ═══════════════════════════════════════════════════════════════════════════ */

import PreviewPanel from '@client/components/panels/PreviewPanel';
import ChatPanel from '@client/components/panels/ChatPanel';
import ExtensionsPanel from '@client/components/panels/ExtensionsPanel';
import type { ChatMessage } from '@/lib/ai-service';

import {
  Eye, FileText,
  FileImage,
  Search, Filter, X,
  Sparkles,
} from 'lucide-react';

const XP_BG = 'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #1a0a2e 50%, #0a1a2e 75%, #0a0a1a 100%)';

/* Styled-mockup shorthand (used by SearchDemo only) */
const GLASS_GRADIENT = 'xp-theme';
const S = { surfaceLight: 'bg-white/[0.04]', surfaceHover: 'hover:bg-white/[0.06]' };
const T = { primary: 'text-white/90', muted: 'text-white/40' };
const B = 'border-white/[0.06]';

/* ─── 2. PreviewDemo — Real PreviewPanel with fake file ─── */

const PREVIEW_FILE = { name: 'App.tsx', path: `${DEMO_PATH}\\src\\App.tsx`, is_dir: false, size: 1200, modified: Date.now() / 1000 - 3600, file_type: 'tsx' };

export function PreviewDemo() {
  return (
    <div className="xp-theme h-full w-full overflow-hidden" style={{ background: XP_BG }}>
      <PreviewPanel
        selectedFile={PREVIEW_FILE}
        formatFileSize={formatFileSize}
        formatDate={demoFormatDate}
        getFolderSize={() => null}
        isCalculatingSize={() => false}
      />
    </div>
  );
}

/* ─── 3. AIChatDemo — Real ChatPanel with fake messages ─── */

const DEMO_CHAT_MESSAGES: ChatMessage[] = [
  { role: 'user', content: 'Organize my downloads folder by file type', timestamp: Date.now() - 60000 },
  { role: 'assistant', content: "Found 83 files. I'll sort them into:\n\n📄 Documents/ — 23 files\n🖼️ Images/ — 47 files\n📦 Archives/ — 8 files\n🎬 Videos/ — 5 files\n\nShall I proceed?", timestamp: Date.now() - 55000 },
  { role: 'user', content: 'Yes, go ahead!', timestamp: Date.now() - 50000 },
  { role: 'assistant', content: "Done! All 83 files have been organized into 4 folders. Here's a summary:\n\n✅ Documents/ — 23 files moved\n✅ Images/ — 47 files moved\n✅ Archives/ — 8 files moved\n✅ Videos/ — 5 files moved", timestamp: Date.now() - 45000 },
];

export function AIChatDemo() {
  const [chatInput, setChatInput] = useState('');

  return (
    <div className="xp-theme h-full w-full overflow-hidden" style={{ background: XP_BG }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ChatPanel
        chatMessages={DEMO_CHAT_MESSAGES}
        chatInput={chatInput}
        setChatInput={setChatInput}
        isAiLoading={false}
        sendChatMessage={() => {}}
        addChatMessage={() => {}}
        currentPath={DEMO_PATH}
        allFiles={DEMO_FILES.map(f => ({ name: f.name, path: f.path, file_type: f.file_type, is_dir: f.is_dir })) as any}
      />
    </div>
  );
}

/* ─── 4. SearchDemo ─── */

const searchResults = [
  { name: 'vacation-sunset.jpg', path: '~/Pictures/2026', size: '4.2 MB', relevance: 'High', score: 0.94, icon: FileImage, color: 'text-[#a78bfa]', thumb: 'bg-[#fb923c]/10' },
  { name: 'product-hero.png', path: '~/Projects/xplorer', size: '2.8 MB', relevance: 'High', score: 0.91, icon: FileImage, color: 'text-[#a78bfa]', thumb: 'bg-[#6366f1]/10' },
  { name: 'screenshot-2026.png', path: '~/Desktop', size: '1.9 MB', relevance: 'Medium', score: 0.85, icon: FileImage, color: 'text-[#a78bfa]', thumb: 'bg-[#a78bfa]/10' },
  { name: 'team-photo.jpg', path: '~/Documents/Work', size: '5.1 MB', relevance: 'Medium', score: 0.82, icon: FileImage, color: 'text-[#a78bfa]', thumb: 'bg-[#34d399]/10' },
];
const filterChips = [
  { label: 'Type: Images', color: 'bg-[#6366f1]/20 text-[#6366f1] border-[#6366f1]/30' },
  { label: 'Size: >1MB', color: 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/30' },
  { label: 'Date: Last month', color: 'bg-[#fb923c]/20 text-[#fb923c] border-[#fb923c]/30' },
];
const relevanceColors: Record<string, string> = { High: 'bg-[#34d399]/20 text-[#34d399]', Medium: 'bg-[#fbbf24]/20 text-[#fbbf24]' };

export function SearchDemo() {
  return (
    <div className={`flex flex-col h-full w-full ${GLASS_GRADIENT} text-[10px] overflow-hidden`} style={{ background: XP_BG }}>
      <div className="px-2.5 pt-2.5 pb-1.5">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${S.surfaceLight} border ${B}`}>
          <Search className="w-3.5 h-3.5 text-[#6366f1] shrink-0" />
          <span className={T.primary}>large images from last month</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-[#6366f1]/20 text-[#6366f1] font-medium">
              <Sparkles className="w-2.5 h-2.5" />AI
            </button>
            <span className={`text-[9px] ${T.muted}`}>847 indexed</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 px-2.5 pb-1.5">
        <Filter className={`w-3 h-3 ${T.muted} shrink-0`} />
        {filterChips.map((chip) => (
          <span key={chip.label} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${chip.color}`}>
            {chip.label}<X className="w-2 h-2 opacity-60" />
          </span>
        ))}
      </div>
      <div className={`flex-1 overflow-hidden border-t ${B}`}>
        <div className={`px-2.5 py-1 text-[9px] ${T.muted}`}>4 results &middot; 0.12s</div>
        {searchResults.map((r) => (
          <div key={r.name} className={`flex items-center gap-2 px-2.5 py-1.5 ${S.surfaceHover} cursor-default transition-colors border-b ${B}`}>
            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${r.thumb}`}>
              <r.icon className={`w-4 h-4 ${r.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${T.primary} font-medium truncate`}>{r.name}</span>
                <span className={`px-1 py-0 rounded text-[8px] font-medium ${relevanceColors[r.relevance]}`}>{r.relevance}</span>
                <span className={`text-[8px] font-mono ${T.muted}`}>{r.score.toFixed(2)}</span>
              </div>
              <div className={`${T.muted} text-[9px] truncate`}>{r.path}</div>
            </div>
            <div className={`text-right shrink-0 ${T.muted} text-[9px]`}>{r.size}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 5. GitDemo — Commit Graph matching real GitLens bottom panel ─── */

import { GitBranch, ChevronDown, RefreshCw } from 'lucide-react';

const GRAPH_COMMITS = [
  { msg: 'v2', author: 'Justin Kimlim', add: 46022, del: 33814, date: '09.03.26 19:30', sha: 'd7d2554', color: '#6366f1' },
  { msg: 'v', author: 'Justin Kimlim', add: 18967, del: 18125, date: '09.03.26 02:26', sha: '34cd9b0', color: '#6366f1' },
  { msg: 'refactor', author: 'Justin Kimlim', add: 5234, del: 3102, date: '08.03.26 21:14', sha: '4eb4e8d', color: '#6366f1' },
  { msg: 'fix: hardcode', author: 'Justin Kimlim', add: 12, del: 8, date: '08.03.26 18:40', sha: '48e5085', color: '#6366f1' },
  { msg: 'refactor: context menu style', author: 'Justin Kimlim', add: 892, del: 456, date: '07.03.26 23:15', sha: '424e61e', color: '#6366f1' },
  { msg: 'feat: add smart search with NL query parsing', author: 'Justin Kimlim', add: 2470, del: 180, date: '07.03.26 14:22', sha: 'a1b2c3d', color: '#6366f1' },
  { msg: 'feat: extension signing and verification', author: 'Justin Kimlim', add: 3120, del: 0, date: '06.03.26 19:50', sha: 'd4e5f6a', color: '#6366f1' },
];

export function GitDemo() {
  return (
    <div className="xp-theme flex flex-col h-full w-full overflow-hidden" style={{ background: XP_BG }}>
      {/* Header bar — matches real GitLens panel */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-xp-surface border-b border-xp-border">
        <span className="text-[10px] font-semibold text-xp-text-muted uppercase tracking-wider">Commit Graph</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-xp-border bg-xp-bg text-xs text-xp-text">
          <GitBranch size={11} className="text-xp-green" />
          <span>master (current)</span>
          <ChevronDown size={11} className="text-xp-text-muted" />
        </div>
        <div className="flex-1 mx-2">
          <input
            type="text"
            placeholder="Search commits..."
            className="w-full px-2 py-0.5 rounded border border-xp-border bg-xp-bg text-xs text-xp-text placeholder:text-xp-text-muted outline-none"
            readOnly
          />
        </div>
        <button className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center text-[9px] font-semibold text-xp-text-muted uppercase tracking-wider border-b border-xp-border bg-xp-surface px-3 py-1">
        <div className="w-8 shrink-0">Graph</div>
        <div className="flex-1 min-w-0 pl-2">Commit Message</div>
        <div className="w-24 shrink-0 text-right">Author</div>
        <div className="w-28 shrink-0 text-right">Changes</div>
        <div className="w-28 shrink-0 text-right">Commit Date / Time</div>
        <div className="w-16 shrink-0 text-right">SHA</div>
      </div>

      {/* Commit rows */}
      <div className="flex-1 overflow-y-auto">
        {GRAPH_COMMITS.map((c, i) => (
          <div
            key={c.sha}
            className="flex items-center px-3 py-1 border-b border-xp-border hover:bg-xp-surface-light cursor-pointer transition-colors group"
          >
            {/* Graph column — vertical line + dot */}
            <div className="w-8 shrink-0 flex justify-center relative">
              <div className="absolute inset-0 flex justify-center">
                <div className="w-px bg-xp-blue/40" style={{ height: '100%' }} />
              </div>
              <div
                className="relative w-2.5 h-2.5 rounded-full border-2 z-10"
                style={{ borderColor: c.color, backgroundColor: i === 0 ? c.color : 'transparent' }}
              />
            </div>

            {/* Commit message */}
            <div className="flex-1 min-w-0 pl-2 text-xs text-xp-text truncate">
              {c.msg}
            </div>

            {/* Author */}
            <div className="w-24 shrink-0 text-right text-xs text-xp-text-muted truncate">
              {c.author}
            </div>

            {/* Changes */}
            <div className="w-28 shrink-0 text-right text-xs font-mono">
              <span className="text-xp-green">+{c.add.toLocaleString()}</span>
              {' '}
              <span className="text-xp-red">-{c.del.toLocaleString()}</span>
            </div>

            {/* Date */}
            <div className="w-28 shrink-0 text-right text-xs text-xp-text-muted font-mono">
              {c.date}
            </div>

            {/* SHA */}
            <div className="w-16 shrink-0 text-right text-xs font-mono text-xp-text-muted">
              {c.sha}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 6. ExtensionsDemo — Real ExtensionsPanel ─── */

const DEMO_THEMES: Record<string, { name: string; primary: string; bg: string; surface: string; text: string }> = {
  glass: { name: 'Xplorer Glass', primary: '#6366f1', bg: '#0a0a1a', surface: '#111122', text: 'rgba(255,255,255,0.92)' },
  'tokyo-night': { name: 'Tokyo Night', primary: '#7aa2f7', bg: '#1a1b26', surface: '#24283b', text: '#c0caf5' },
  dracula: { name: 'Dracula', primary: '#bd93f9', bg: '#282a36', surface: '#44475a', text: '#f8f8f2' },
  nord: { name: 'Nord', primary: '#88c0d0', bg: '#2e3440', surface: '#3b4252', text: '#d8dee9' },
  catppuccin: { name: 'Catppuccin', primary: '#f5c2e7', bg: '#1e1e2e', surface: '#313244', text: '#cdd6f4' },
  solarized: { name: 'Solarized', primary: '#b58900', bg: '#002b36', surface: '#073642', text: '#839496' },
};

export function ExtensionsDemo() {
  const [demoTheme, setDemoTheme] = useState('glass');

  return (
    <div className="xp-theme h-full w-full overflow-hidden" style={{ background: XP_BG }}>
      <ExtensionsPanel
        themes={DEMO_THEMES}
        theme={demoTheme}
        applyTheme={setDemoTheme}
        agentEnabled={true}
        toggleAgent={() => {}}
      />
    </div>
  );
}
