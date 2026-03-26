import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Editor, Sidebar, Command } from '@xplorer/extension-sdk';

// ══════════════════════════════════════════════════════════════════════════════
// § 1. TYPES & INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

type NodeKind = 'file' | 'component' | 'hook' | 'function' | 'class' | 'module' | 'service' | 'page' | 'type' | 'store' | 'folder';
type NodeStatus = 'planned' | 'realized' | 'modified' | 'outdated';
type EdgeKind = 'imports' | 'exports' | 'calls' | 'extends' | 'renders' | 'planned';
type AppMode = 'view' | 'plan' | 'execute';
type LayoutAlgo = 'tree' | 'force' | 'manual';

interface ArchNode {
  id: string;
  kind: NodeKind;
  status: NodeStatus;
  label: string;
  filePath?: string;
  plannedPath?: string;
  description?: string;
  codePreview?: string;
  exports?: string[];
  imports?: string[];
  loc?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed?: boolean;
  locked?: boolean;
  generatedCode?: string;
}

interface ArchEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
}

interface ArchGroup {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
  collapsed: boolean;
}

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  mode: AppMode;
  selectedNodeId: string | null;
  showMinimap: boolean;
  showGrid: boolean;
  layoutAlgorithm: LayoutAlgo;
}

interface ArchitectFile {
  version: 1;
  projectRoot: string;
  metadata: {
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;
    language: string;
  };
  graph: GraphData;
  viewState: ViewState;
}

interface GraphData {
  nodes: ArchNode[];
  edges: ArchEdge[];
  groups: ArchGroup[];
}

interface ParsedImport {
  source: string;
  specifiers: string[];
}

interface ParsedExport {
  name: string;
  kind: string;
}

interface FileTreeEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileTreeEntry[];
  expanded?: boolean;
  matchedNodeId?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// § 2. CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const NODE_W = 180;
const NODE_H = 70;
const X_GAP = 50;
const Y_GAP = 90;
const PORT_R = 5;
const MAX_FILES = 2000;
const MAX_DEPTH = 8;
const BATCH_SIZE = 10;

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'target', '__pycache__', 'dist', 'build',
  '.next', 'vendor', '.cache', 'coverage', '.turbo', '.nuxt',
  'test-results', 'playwright-report', '.svelte-kit',
]);

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.vue', '.svelte', '.cpp', '.c', '.h', '.hpp', '.cs', '.rb',
]);

const NODE_COLORS: Record<NodeKind, string> = {
  component: '#7aa2f7',
  hook:      '#bb9af7',
  function:  '#9ece6a',
  class:     '#2ac3de',
  module:    '#ff9e64',
  service:   '#f7768e',
  page:      '#e0af68',
  type:      '#73daca',
  store:     '#ff7a93',
  file:      '#3b4261',
  folder:    '#565f89',
};

const STATUS_COLORS: Record<NodeStatus, string> = {
  planned:  '#ff9e64',
  realized: '#9ece6a',
  modified: '#e0af68',
  outdated: '#f7768e',
};

const KIND_LABELS: Record<NodeKind, string> = {
  file: 'File', component: 'Component', hook: 'Hook', function: 'Function',
  class: 'Class', module: 'Module', service: 'Service', page: 'Page',
  type: 'Type', store: 'Store', folder: 'Folder',
};

const DEFAULT_VIEW: ViewState = {
  zoom: 1, panX: 50, panY: 50,
  mode: 'view', selectedNodeId: null,
  showMinimap: true, showGrid: true, layoutAlgorithm: 'tree',
};

// ══════════════════════════════════════════════════════════════════════════════
// § 3. INLINE SVG ICONS
// ══════════════════════════════════════════════════════════════════════════════

function IconComponent() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
    React.createElement('path', { d: 'M9 3v18M21 9H9' }));
}

function IconHook() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M12 2v6m0 0a4 4 0 100 8 4 4 0 000-8zM12 22v-6' }));
}

function IconFunction() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M10 3H6a2 2 0 00-2 2v2m0 0h12M4 7v10a2 2 0 002 2h4' }),
    React.createElement('path', { d: 'M8 12h8' }));
}

function IconClass() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
    React.createElement('path', { d: 'M8 12h8M12 8v8' }));
}

function IconFile() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' }),
    React.createElement('path', { d: 'M14 2v6h6' }));
}

function IconModule() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' }),
    React.createElement('path', { d: 'M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' }));
}

function IconService() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('rect', { x: 2, y: 2, width: 20, height: 8, rx: 2 }),
    React.createElement('rect', { x: 2, y: 14, width: 20, height: 8, rx: 2 }),
    React.createElement('line', { x1: 6, y1: 6, x2: 6.01, y2: 6 }),
    React.createElement('line', { x1: 6, y1: 18, x2: 6.01, y2: 18 }));
}

function IconPage() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' }),
    React.createElement('path', { d: 'M22 6l-10 7L2 6' }));
}

function IconType() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M4 7V4h16v3M9 20h6M12 4v16' }));
}

function IconStore() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }),
    React.createElement('path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }),
    React.createElement('path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' }));
}

function IconFolder() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' }));
}

function IconScan() {
  return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('circle', { cx: 11, cy: 11, r: 8 }),
    React.createElement('path', { d: 'M21 21l-4.35-4.35' }));
}

function IconPlus() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
    React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 }));
}

function IconLayout() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('rect', { x: 3, y: 3, width: 7, height: 7 }),
    React.createElement('rect', { x: 14, y: 3, width: 7, height: 7 }),
    React.createElement('rect', { x: 14, y: 14, width: 7, height: 7 }),
    React.createElement('rect', { x: 3, y: 14, width: 7, height: 7 }));
}

function IconUndo() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M3 7v6h6' }),
    React.createElement('path', { d: 'M3 13a9 9 0 019-9 9.75 9.75 0 017 3l3 3' }));
}

function IconSave() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z' }),
    React.createElement('polyline', { points: '17 21 17 13 7 13 7 21' }),
    React.createElement('polyline', { points: '7 3 7 8 15 8' }));
}

function IconPlay() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' },
    React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' }));
}

function IconTrash() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' }));
}

function IconEdit() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7' }),
    React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' }));
}

function IconAI() {
  return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    React.createElement('path', { d: 'M12 2a4 4 0 014 4v2a4 4 0 01-8 0V6a4 4 0 014-4z' }),
    React.createElement('path', { d: 'M16 14H8a4 4 0 00-4 4v2h16v-2a4 4 0 00-4-4z' }));
}

function IconChevron({ open }: { open: boolean }) {
  return React.createElement('svg', {
    width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2,
    style: { transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' },
  }, React.createElement('path', { d: 'M9 18l6-6-6-6' }));
}

const KIND_ICONS: Record<NodeKind, () => React.ReactElement> = {
  component: IconComponent, hook: IconHook, function: IconFunction, class: IconClass,
  file: IconFile, module: IconModule, service: IconService, page: IconPage,
  type: IconType, store: IconStore, folder: IconFolder,
};

// ══════════════════════════════════════════════════════════════════════════════
// § 4. UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

let _idCounter = 0;
function uid(prefix = 'n'): string {
  return prefix + '_' + Date.now().toString(36) + '_' + (++_idCounter).toString(36);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
}

function getFileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path;
}

function getFileExt(path: string): string {
  const name = getFileName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

function getParentDir(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

function relativePath(from: string, to: string): string {
  const f = from.replace(/\\/g, '/');
  const t = to.replace(/\\/g, '/');
  if (t.startsWith(f + '/')) return t.slice(f.length + 1);
  return t;
}

function resolveImportPath(importSource: string, fromFile: string, allPaths: Set<string>): string | null {
  if (importSource.startsWith('.')) {
    const dir = getParentDir(fromFile).replace(/\\/g, '/');
    // Simplistic resolution: normalize ../  and ./
    const parts = (dir + '/' + importSource).split('/');
    const resolved: string[] = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else if (p !== '.') resolved.push(p);
    }
    const base = resolved.join('/');
    // Try direct, then with extensions
    const candidates = [base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '/index.ts', base + '/index.tsx', base + '/index.js'];
    for (const c of candidates) {
      if (allPaths.has(c)) return c;
    }
  }
  return null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ══════════════════════════════════════════════════════════════════════════════
// § 5. ARCHITECTURE SCANNER
// ══════════════════════════════════════════════════════════════════════════════

// Regex patterns for TypeScript/JavaScript
const RE_IMPORT = /import\s+(?:type\s+)?(?:(\{[^}]+\})|([\w$]+))(?:\s*,\s*(?:(\{[^}]+\})|([\w$]+)))?\s+from\s+['"]([^'"]+)['"]/g;
const RE_EXPORT_FN = /export\s+(?:default\s+)?(?:async\s+)?function\s+([\w$]+)/g;
const RE_EXPORT_CLASS = /export\s+(?:default\s+)?class\s+([\w$]+)/g;
const RE_EXPORT_CONST = /export\s+(?:default\s+)?(?:const|let|var)\s+([\w$]+)/g;
const RE_EXPORT_TYPE = /export\s+(?:type|interface)\s+([\w$]+)/g;
const RE_REEXPORT = /export\s+(?:\{[^}]+\}|\*)\s+from\s+['"]([^'"]+)['"]/g;
const RE_COMPONENT = /(?:function|const)\s+([A-Z][\w$]*)\s*(?:[:=])/;
const RE_HOOK = /(?:function|const)\s+(use[A-Z][\w$]*)/g;

// Rust patterns
const RE_RUST_USE = /use\s+((?:crate|super|self)(?:::\w+)+)/g;
const RE_RUST_FN = /(?:pub(?:\(.*?\))?\s+)?(?:async\s+)?fn\s+(\w+)/g;
const RE_RUST_STRUCT = /(?:pub(?:\(.*?\))?\s+)?struct\s+(\w+)/g;
const RE_RUST_TRAIT = /(?:pub(?:\(.*?\))?\s+)?trait\s+(\w+)/g;

// Python patterns
const RE_PY_IMPORT = /(?:from\s+(\S+)\s+)?import\s+(.+)/g;
const RE_PY_CLASS = /class\s+(\w+)/g;
const RE_PY_FUNC = /def\s+(\w+)/g;

function parseFileContent(content: string, filePath: string): { imports: ParsedImport[]; exports: ParsedExport[]; loc: number } {
  const ext = getFileExt(filePath);
  const lines = content.split('\n');
  const loc = lines.length;
  const imports: ParsedImport[] = [];
  const exports: ParsedExport[] = [];

  if (['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'].includes(ext)) {
    // Parse imports
    let m: RegExpExecArray | null;
    const importRe = new RegExp(RE_IMPORT.source, 'g');
    while ((m = importRe.exec(content)) !== null) {
      const specifiers: string[] = [];
      if (m[1]) m[1].replace(/[\w$]+/g, (s) => { specifiers.push(s); return s; });
      if (m[2]) specifiers.push(m[2]);
      if (m[3]) m[3].replace(/[\w$]+/g, (s) => { specifiers.push(s); return s; });
      if (m[4]) specifiers.push(m[4]);
      imports.push({ source: m[5], specifiers });
    }

    // Parse exports
    const fns = new RegExp(RE_EXPORT_FN.source, 'g');
    while ((m = fns.exec(content)) !== null) exports.push({ name: m[1], kind: 'function' });
    const cls = new RegExp(RE_EXPORT_CLASS.source, 'g');
    while ((m = cls.exec(content)) !== null) exports.push({ name: m[1], kind: 'class' });
    const cnst = new RegExp(RE_EXPORT_CONST.source, 'g');
    while ((m = cnst.exec(content)) !== null) exports.push({ name: m[1], kind: 'const' });
    const types = new RegExp(RE_EXPORT_TYPE.source, 'g');
    while ((m = types.exec(content)) !== null) exports.push({ name: m[1], kind: 'type' });
  } else if (ext === '.rs') {
    let m: RegExpExecArray | null;
    const useRe = new RegExp(RE_RUST_USE.source, 'g');
    while ((m = useRe.exec(content)) !== null) imports.push({ source: m[1], specifiers: [] });
    const fnRe = new RegExp(RE_RUST_FN.source, 'g');
    while ((m = fnRe.exec(content)) !== null) exports.push({ name: m[1], kind: 'function' });
    const stRe = new RegExp(RE_RUST_STRUCT.source, 'g');
    while ((m = stRe.exec(content)) !== null) exports.push({ name: m[1], kind: 'class' });
    const trRe = new RegExp(RE_RUST_TRAIT.source, 'g');
    while ((m = trRe.exec(content)) !== null) exports.push({ name: m[1], kind: 'type' });
  } else if (ext === '.py') {
    let m: RegExpExecArray | null;
    const pyImp = new RegExp(RE_PY_IMPORT.source, 'g');
    while ((m = pyImp.exec(content)) !== null) imports.push({ source: m[1] || m[2], specifiers: [] });
    const pyC = new RegExp(RE_PY_CLASS.source, 'g');
    while ((m = pyC.exec(content)) !== null) exports.push({ name: m[1], kind: 'class' });
    const pyF = new RegExp(RE_PY_FUNC.source, 'g');
    while ((m = pyF.exec(content)) !== null) exports.push({ name: m[1], kind: 'function' });
  }

  return { imports, exports, loc };
}

function inferKind(filePath: string, exports: ParsedExport[], content: string): NodeKind {
  const name = getFileName(filePath);
  const ext = getFileExt(filePath);
  const nameNoExt = name.replace(/\.[^.]+$/, '');

  if (name === 'index.ts' || name === 'index.tsx' || name === 'index.js' || name === 'mod.rs' || name === '__init__.py') return 'module';
  if (/^use[A-Z]/.test(nameNoExt) && ['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return 'hook';
  if (/^[A-Z]/.test(nameNoExt) && ['.tsx', '.jsx'].includes(ext)) return 'component';
  if (/page|route/i.test(nameNoExt)) return 'page';
  if (/\.d\.ts$/.test(name) || /types?\./i.test(nameNoExt)) return 'type';
  if (/service|api/i.test(nameNoExt)) return 'service';
  if (/store|context|state/i.test(nameNoExt)) return 'store';

  if (RE_COMPONENT.test(content)) return 'component';
  const hookTest = new RegExp(RE_HOOK.source, 'g');
  if (hookTest.test(content) && exports.some((e) => e.name.startsWith('use'))) return 'hook';
  if (exports.some((e) => e.kind === 'class')) return 'class';

  return 'file';
}

async function scanProject(
  api: any,
  rootPath: string,
  onProgress?: (msg: string) => void,
): Promise<{ nodes: ArchNode[]; edges: ArchEdge[]; groups: ArchGroup[] }> {
  const allFiles: string[] = [];
  const allPathsNorm = new Set<string>();

  // Recursive file listing
  async function listDir(dir: string, depth: number) {
    if (depth > MAX_DEPTH || allFiles.length >= MAX_FILES) return;
    try {
      const entries = await api.files.list(dir);
      for (const entry of entries) {
        const name = entry.name || getFileName(entry.path);
        if (entry.is_dir) {
          if (!IGNORED_DIRS.has(name) && !name.startsWith('.')) {
            await listDir(entry.path, depth + 1);
          }
        } else {
          const ext = getFileExt(entry.path);
          if (CODE_EXTS.has(ext) && allFiles.length < MAX_FILES) {
            allFiles.push(entry.path);
            allPathsNorm.add(entry.path.replace(/\\/g, '/'));
          }
        }
      }
    } catch {
      // Permission denied or other error — skip
    }
  }

  onProgress?.('Scanning directories...');
  await listDir(rootPath, 0);
  onProgress?.(`Found ${allFiles.length} source files. Analyzing...`);

  // Parse files in batches
  const nodeMap = new Map<string, ArchNode>();
  const importMap = new Map<string, ParsedImport[]>();

  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (fp) => {
        try {
          const content = await api.files.readText(fp);
          return { path: fp, content, ...parseFileContent(content, fp) };
        } catch {
          return { path: fp, content: '', imports: [], exports: [], loc: 0 };
        }
      }),
    );

    for (const r of results) {
      const kind = inferKind(r.path, r.exports, r.content);
      const node: ArchNode = {
        id: uid('n'),
        kind,
        status: 'realized',
        label: getFileName(r.path).replace(/\.[^.]+$/, ''),
        filePath: r.path,
        codePreview: r.content.split('\n').slice(0, 10).join('\n'),
        exports: r.exports.map((e) => e.name),
        imports: r.imports.map((im) => im.source),
        loc: r.loc,
        x: 0,
        y: 0,
        width: NODE_W,
        height: NODE_H,
      };
      nodeMap.set(r.path.replace(/\\/g, '/'), node);
      importMap.set(r.path.replace(/\\/g, '/'), r.imports);
    }

    onProgress?.(`Analyzed ${Math.min(i + BATCH_SIZE, allFiles.length)} / ${allFiles.length} files`);
  }

  // Build edges
  const edges: ArchEdge[] = [];
  for (const [filePath, imports] of importMap) {
    const sourceNode = nodeMap.get(filePath);
    if (!sourceNode) continue;
    for (const imp of imports) {
      const resolved = resolveImportPath(imp.source, filePath, allPathsNorm);
      if (resolved) {
        const targetNode = nodeMap.get(resolved);
        if (targetNode && targetNode.id !== sourceNode.id) {
          edges.push({
            id: uid('e'),
            source: sourceNode.id,
            target: targetNode.id,
            kind: 'imports',
            label: imp.specifiers.length > 0 ? imp.specifiers.slice(0, 2).join(', ') : undefined,
          });
        }
      }
    }
  }

  // Build groups from directory structure
  const dirGroups = new Map<string, string[]>();
  for (const [fp, node] of nodeMap) {
    const dir = getParentDir(fp);
    const relDir = relativePath(rootPath.replace(/\\/g, '/'), dir);
    if (!dirGroups.has(relDir)) dirGroups.set(relDir, []);
    dirGroups.get(relDir)!.push(node.id);
  }

  const groupColors = ['rgba(122,162,247,0.08)', 'rgba(187,154,247,0.08)', 'rgba(158,206,106,0.08)', 'rgba(42,195,222,0.08)', 'rgba(255,158,100,0.08)', 'rgba(247,118,142,0.08)'];
  const groups: ArchGroup[] = [];
  let gi = 0;
  for (const [dir, nodeIds] of dirGroups) {
    if (nodeIds.length > 1) {
      groups.push({
        id: uid('g'),
        label: dir || '(root)',
        nodeIds,
        color: groupColors[gi % groupColors.length],
        collapsed: false,
      });
      gi++;
    }
  }

  const nodes = Array.from(nodeMap.values());
  onProgress?.(`Scan complete: ${nodes.length} nodes, ${edges.length} edges, ${groups.length} groups`);
  return { nodes, edges, groups };
}

// ══════════════════════════════════════════════════════════════════════════════
// § 6. LAYOUT ALGORITHMS
// ══════════════════════════════════════════════════════════════════════════════

function treeLayout(nodes: ArchNode[], edges: ArchEdge[]): void {
  if (nodes.length === 0) return;

  // Build adjacency
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const n of nodes) {
    incoming.set(n.id, new Set());
    outgoing.set(n.id, new Set());
  }
  for (const e of edges) {
    outgoing.get(e.source)?.add(e.target);
    incoming.get(e.target)?.add(e.source);
  }

  // BFS rank assignment from roots
  const ranks = new Map<string, number>();
  const roots = nodes.filter((n) => (incoming.get(n.id)?.size || 0) === 0);
  if (roots.length === 0) roots.push(nodes[0]); // break cycle

  const queue = roots.map((r) => ({ id: r.id, rank: 0 }));
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ranks.set(id, rank);
    for (const child of outgoing.get(id) || []) {
      if (!visited.has(child)) queue.push({ id: child, rank: rank + 1 });
    }
  }
  // Assign unvisited nodes
  for (const n of nodes) {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  }

  // Group by rank
  const byRank = new Map<number, ArchNode[]>();
  for (const n of nodes) {
    const r = ranks.get(n.id) || 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  }

  // Assign coordinates
  const maxRank = Math.max(...byRank.keys());
  for (let r = 0; r <= maxRank; r++) {
    const row = byRank.get(r) || [];
    const totalW = row.length * NODE_W + (row.length - 1) * X_GAP;
    const startX = -totalW / 2 + 400; // center around 400
    for (let i = 0; i < row.length; i++) {
      if (!row[i].locked) {
        row[i].x = startX + i * (NODE_W + X_GAP);
        row[i].y = r * (NODE_H + Y_GAP) + 50;
      }
    }
  }
}

function forceLayout(nodes: ArchNode[], edges: ArchEdge[]): void {
  if (nodes.length === 0) return;
  const REPULSION = 5000;
  const SPRING = 0.02;
  const IDEAL_LEN = 200;
  const GRAVITY = 0.01;
  const ITERATIONS = 120;

  // Init positions if all at 0
  const allZero = nodes.every((n) => n.x === 0 && n.y === 0);
  if (allZero) {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].x = Math.cos((i / nodes.length) * Math.PI * 2) * 300 + 400;
      nodes[i].y = Math.sin((i / nodes.length) * Math.PI * 2) * 300 + 300;
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const temp = 1 - iter / ITERATIONS;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].locked) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force * temp;
        const fy = (dy / dist) * force * temp;
        if (!a.locked) { a.x -= fx; a.y -= fy; }
        if (!b.locked) { b.x += fx; b.y += fy; }
      }
    }

    // Attraction
    for (const e of edges) {
      const s = nodeById.get(e.source), t = nodeById.get(e.target);
      if (!s || !t) continue;
      let dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - IDEAL_LEN) * SPRING * temp;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (!s.locked) { s.x += fx; s.y += fy; }
      if (!t.locked) { t.x -= fx; t.y -= fy; }
    }

    // Gravity
    for (const n of nodes) {
      if (n.locked) continue;
      n.x -= (n.x - 400) * GRAVITY * temp;
      n.y -= (n.y - 300) * GRAVITY * temp;
    }
  }
}

function applyLayout(nodes: ArchNode[], edges: ArchEdge[], algo: LayoutAlgo): void {
  if (algo === 'tree') treeLayout(nodes, edges);
  else if (algo === 'force') forceLayout(nodes, edges);
}

// ══════════════════════════════════════════════════════════════════════════════
// § 7. GRAPH DATA HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function addNode(graph: GraphData, kind: NodeKind, label: string, x: number, y: number, extra?: Partial<ArchNode>): GraphData {
  const node: ArchNode = {
    id: uid('n'), kind, status: 'planned', label,
    x, y, width: NODE_W, height: NODE_H, ...extra,
  };
  return { ...graph, nodes: [...graph.nodes, node] };
}

function removeNode(graph: GraphData, nodeId: string): GraphData {
  return {
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    groups: graph.groups.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => id !== nodeId) })).filter((g) => g.nodeIds.length > 0),
  };
}

function addEdge(graph: GraphData, source: string, target: string, kind: EdgeKind, label?: string): GraphData {
  if (source === target) return graph;
  if (graph.edges.some((e) => e.source === source && e.target === target)) return graph;
  return { ...graph, edges: [...graph.edges, { id: uid('e'), source, target, kind, label }] };
}

function updateNode(graph: GraphData, nodeId: string, updates: Partial<ArchNode>): GraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// § 8. SVG COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── BezierEdge ──────────────────────────────────────────────────────────────

interface BezierEdgeProps {
  edge: ArchEdge;
  sourceNode: ArchNode;
  targetNode: ArchNode;
  selected: boolean;
}

function BezierEdge({ edge, sourceNode, targetNode, selected }: BezierEdgeProps) {
  const sx = sourceNode.x + sourceNode.width;
  const sy = sourceNode.y + sourceNode.height / 2;
  const tx = targetNode.x;
  const ty = targetNode.y + targetNode.height / 2;
  const dx = Math.abs(tx - sx) * 0.4;
  const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

  const edgeColor = edge.kind === 'planned' ? '#ff9e64' : selected ? '#7aa2f7' : 'rgba(255,255,255,0.25)';

  return React.createElement('g', null,
    React.createElement('path', {
      d, fill: 'none', stroke: edgeColor, strokeWidth: selected ? 2 : 1.2,
      strokeDasharray: edge.kind === 'planned' ? '6,3' : 'none',
      markerEnd: 'url(#arrowhead)', opacity: selected ? 1 : 0.6,
    }),
    edge.label ? React.createElement('text', {
      x: (sx + tx) / 2, y: (sy + ty) / 2 - 8,
      fontSize: 9, fill: 'rgba(255,255,255,0.4)', textAnchor: 'middle',
    }, truncate(edge.label, 18)) : null,
  );
}

// ── GraphNode ───────────────────────────────────────────────────────────────

interface GraphNodeProps {
  node: ArchNode;
  selected: boolean;
  isPlanMode: boolean;
  isExecuteMode: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onPortMouseDown?: (side: 'left' | 'right', e: React.MouseEvent) => void;
  onPortMouseUp?: (side: 'left' | 'right', e: React.MouseEvent) => void;
  onGenerate?: () => void;
}

function GraphNode({ node, selected, isPlanMode, isExecuteMode, onMouseDown, onClick, onDoubleClick, onPortMouseDown, onPortMouseUp, onGenerate }: GraphNodeProps) {
  const color = node.collapsed ? '#444' : (NODE_COLORS[node.kind] || NODE_COLORS.file);
  const statusColor = STATUS_COLORS[node.status] || '#666';
  const isPlanned = node.status === 'planned';
  const KindIcon = KIND_ICONS[node.kind] || IconFile;

  return React.createElement('g', {
    transform: `translate(${node.x}, ${node.y})`,
    onMouseDown, onClick, onDoubleClick,
    style: { cursor: 'grab' },
  },
    // Shadow
    React.createElement('rect', {
      x: 2, y: 2, width: node.width, height: node.height, rx: 8,
      fill: 'rgba(0,0,0,0.3)', filter: 'blur(4px)',
    }),
    // Background
    React.createElement('rect', {
      width: node.width, height: node.height, rx: 8,
      fill: color, fillOpacity: 0.85,
      stroke: selected ? '#7aa2f7' : isPlanned ? '#ff9e64' : 'rgba(255,255,255,0.15)',
      strokeWidth: selected ? 2.5 : 1.5,
      strokeDasharray: isPlanned ? '5,3' : 'none',
    }),
    // Kind icon
    React.createElement('g', { transform: 'translate(10, 12)' },
      React.createElement(KindIcon)),
    // Label
    React.createElement('text', {
      x: 30, y: 24, fontSize: 12, fontWeight: 600,
      fill: 'white', style: { pointerEvents: 'none' },
    }, truncate(node.label, 18)),
    // Subtitle
    React.createElement('text', {
      x: 10, y: 44, fontSize: 10,
      fill: 'rgba(255,255,255,0.5)', style: { pointerEvents: 'none' },
    }, `${KIND_LABELS[node.kind]}${node.loc ? ` \u00B7 ${node.loc} loc` : ''}`),
    // Status dot
    React.createElement('circle', {
      cx: node.width - 14, cy: 14, r: 4, fill: statusColor,
    }),
    // Exports badge
    node.exports && node.exports.length > 0 ? React.createElement('text', {
      x: node.width - 10, y: node.height - 8, fontSize: 9,
      fill: 'rgba(255,255,255,0.35)', textAnchor: 'end',
    }, `${node.exports.length} exp`) : null,
    // Connection ports (visible when plan mode or hovered)
    (isPlanMode) ? React.createElement('g', null,
      // Left port
      React.createElement('circle', {
        cx: 0, cy: node.height / 2, r: PORT_R,
        fill: 'var(--xp-bg, #1a1a2e)', stroke: '#7aa2f7', strokeWidth: 1.5,
        style: { cursor: 'crosshair' },
        onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); onPortMouseDown?.('left', e); },
        onMouseUp: (e: React.MouseEvent) => { e.stopPropagation(); onPortMouseUp?.('left', e); },
      }),
      // Right port
      React.createElement('circle', {
        cx: node.width, cy: node.height / 2, r: PORT_R,
        fill: 'var(--xp-bg, #1a1a2e)', stroke: '#7aa2f7', strokeWidth: 1.5,
        style: { cursor: 'crosshair' },
        onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); onPortMouseDown?.('right', e); },
        onMouseUp: (e: React.MouseEvent) => { e.stopPropagation(); onPortMouseUp?.('right', e); },
      }),
    ) : null,
    // Generate button in execute mode for planned nodes
    (isExecuteMode && isPlanned && onGenerate) ? React.createElement('g', {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); onGenerate(); },
      style: { cursor: 'pointer' },
    },
      React.createElement('rect', {
        x: node.width / 2 - 32, y: node.height - 4,
        width: 64, height: 20, rx: 4,
        fill: '#9ece6a', fillOpacity: 0.9,
      }),
      React.createElement('text', {
        x: node.width / 2, y: node.height + 10,
        fontSize: 10, fontWeight: 600, fill: '#1a1a2e', textAnchor: 'middle',
      }, 'Generate'),
    ) : null,
  );
}

// ── GroupRect ────────────────────────────────────────────────────────────────

function GroupRect({ group, nodes }: { group: ArchGroup; nodes: ArchNode[] }) {
  const groupNodes = nodes.filter((n) => group.nodeIds.includes(n.id));
  if (groupNodes.length === 0) return null;
  const pad = 20;
  const minX = Math.min(...groupNodes.map((n) => n.x)) - pad;
  const minY = Math.min(...groupNodes.map((n) => n.y)) - pad - 18;
  const maxX = Math.max(...groupNodes.map((n) => n.x + n.width)) + pad;
  const maxY = Math.max(...groupNodes.map((n) => n.y + n.height)) + pad;

  return React.createElement('g', null,
    React.createElement('rect', {
      x: minX, y: minY, width: maxX - minX, height: maxY - minY,
      rx: 10, fill: group.color, stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1,
    }),
    React.createElement('text', {
      x: minX + 8, y: minY + 14, fontSize: 10, fill: 'rgba(255,255,255,0.35)', fontWeight: 500,
    }, truncate(group.label, 30)),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 9. GRAPH CANVAS
// ══════════════════════════════════════════════════════════════════════════════

interface GraphCanvasProps {
  graph: GraphData;
  viewState: ViewState;
  onViewStateChange: (vs: ViewState) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onAddEdge: (source: string, target: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onGenerate?: (nodeId: string) => void;
}

function GraphCanvas({ graph, viewState, onViewStateChange, onNodeSelect, onNodeMove, onAddEdge, onNodeDoubleClick, onGenerate }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; ox: number; oy: number } | null>(null);
  const [panning, setPanning] = useState<{ sx: number; sy: number } | null>(null);
  const [drawingEdge, setDrawingEdge] = useState<{ sourceId: string; mx: number; my: number } | null>(null);

  const nodeById = useMemo(() => {
    const m = new Map<string, ArchNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph.nodes]);

  const isPlan = viewState.mode === 'plan';
  const isExec = viewState.mode === 'execute';

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = clamp(viewState.zoom * factor, 0.1, 4);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newPanX = mx - (mx - viewState.panX) * (newZoom / viewState.zoom);
    const newPanY = my - (my - viewState.panY) * (newZoom / viewState.zoom);
    onViewStateChange({ ...viewState, zoom: newZoom, panX: newPanX, panY: newPanY });
  }, [viewState, onViewStateChange]);

  // Pan / drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element)?.getAttribute?.('data-bg') === '1') {
      setPanning({ sx: e.clientX - viewState.panX, sy: e.clientY - viewState.panY });
      onNodeSelect(null);
    }
  }, [viewState.panX, viewState.panY, onNodeSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      onViewStateChange({ ...viewState, panX: e.clientX - panning.sx, panY: e.clientY - panning.sy });
    } else if (dragging) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - viewState.panX) / viewState.zoom - dragging.ox;
      const y = (e.clientY - rect.top - viewState.panY) / viewState.zoom - dragging.oy;
      onNodeMove(dragging.nodeId, x, y);
    } else if (drawingEdge) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDrawingEdge({
        ...drawingEdge,
        mx: (e.clientX - rect.left - viewState.panX) / viewState.zoom,
        my: (e.clientY - rect.top - viewState.panY) / viewState.zoom,
      });
    }
  }, [panning, dragging, drawingEdge, viewState, onViewStateChange, onNodeMove]);

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
    if (panning) setPanning(null);
    if (drawingEdge) setDrawingEdge(null);
  }, [dragging, panning, drawingEdge]);

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodeById.get(nodeId);
    if (!node || node.locked) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ox = (e.clientX - rect.left - viewState.panX) / viewState.zoom - node.x;
    const oy = (e.clientY - rect.top - viewState.panY) / viewState.zoom - node.y;
    setDragging({ nodeId, ox, oy });
  }, [nodeById, viewState]);

  const handlePortMouseDown = useCallback((nodeId: string, _side: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodeById.get(nodeId);
    if (!node) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawingEdge({
      sourceId: nodeId,
      mx: (e.clientX - rect.left - viewState.panX) / viewState.zoom,
      my: (e.clientY - rect.top - viewState.panY) / viewState.zoom,
    });
  }, [nodeById, viewState]);

  const handlePortMouseUp = useCallback((nodeId: string) => {
    if (drawingEdge && drawingEdge.sourceId !== nodeId) {
      onAddEdge(drawingEdge.sourceId, nodeId);
    }
    setDrawingEdge(null);
  }, [drawingEdge, onAddEdge]);

  return React.createElement('svg', {
    ref: svgRef,
    style: { width: '100%', height: '100%', background: 'transparent', outline: 'none' },
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp,
  },
    // Defs
    React.createElement('defs', null,
      React.createElement('marker', {
        id: 'arrowhead', markerWidth: 8, markerHeight: 6,
        refX: 8, refY: 3, orient: 'auto',
      }, React.createElement('polygon', { points: '0 0, 8 3, 0 6', fill: 'rgba(255,255,255,0.4)' })),
      viewState.showGrid ? React.createElement('pattern', {
        id: 'grid', width: 30, height: 30, patternUnits: 'userSpaceOnUse',
      },
        React.createElement('path', {
          d: 'M 30 0 L 0 0 0 30', fill: 'none', stroke: 'rgba(255,255,255,0.04)', strokeWidth: 0.5,
        }),
      ) : null,
    ),
    // Background
    React.createElement('rect', {
      width: '100%', height: '100%',
      fill: viewState.showGrid ? 'url(#grid)' : 'transparent',
      'data-bg': '1',
    }),
    // Viewport transform
    React.createElement('g', { transform: `translate(${viewState.panX}, ${viewState.panY}) scale(${viewState.zoom})` },
      // Groups
      ...graph.groups.map((g) =>
        React.createElement(GroupRect, { key: g.id, group: g, nodes: graph.nodes })),
      // Edges
      ...graph.edges.map((e) => {
        const s = nodeById.get(e.source), t = nodeById.get(e.target);
        if (!s || !t) return null;
        return React.createElement(BezierEdge, {
          key: e.id, edge: e, sourceNode: s, targetNode: t,
          selected: viewState.selectedNodeId === e.source || viewState.selectedNodeId === e.target,
        });
      }),
      // Drawing edge preview
      drawingEdge ? (() => {
        const src = nodeById.get(drawingEdge.sourceId);
        if (!src) return null;
        return React.createElement('line', {
          x1: src.x + src.width, y1: src.y + src.height / 2,
          x2: drawingEdge.mx, y2: drawingEdge.my,
          stroke: '#7aa2f7', strokeWidth: 1.5, strokeDasharray: '4,3', opacity: 0.7,
        });
      })() : null,
      // Nodes
      ...graph.nodes.map((n) =>
        React.createElement(GraphNode, {
          key: n.id, node: n,
          selected: viewState.selectedNodeId === n.id,
          isPlanMode: isPlan,
          isExecuteMode: isExec,
          onMouseDown: (e: React.MouseEvent) => handleNodeMouseDown(n.id, e),
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onNodeSelect(n.id); },
          onDoubleClick: (e: React.MouseEvent) => { e.stopPropagation(); onNodeDoubleClick(n.id); },
          onPortMouseDown: isPlan ? (side: 'left' | 'right', e: React.MouseEvent) => handlePortMouseDown(n.id, side, e) : undefined,
          onPortMouseUp: isPlan ? (_side: 'left' | 'right') => handlePortMouseUp(n.id) : undefined,
          onGenerate: isExec && n.status === 'planned' ? () => onGenerate?.(n.id) : undefined,
        })),
    ),
    // Minimap
    viewState.showMinimap ? React.createElement(Minimap, { graph, viewState }) : null,
  );
}

// ── Minimap ─────────────────────────────────────────────────────────────────

function Minimap({ graph, viewState }: { graph: GraphData; viewState: ViewState }) {
  if (graph.nodes.length === 0) return null;
  const minX = Math.min(...graph.nodes.map((n) => n.x));
  const minY = Math.min(...graph.nodes.map((n) => n.y));
  const maxX = Math.max(...graph.nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...graph.nodes.map((n) => n.y + n.height));
  const w = maxX - minX + 40, h = maxY - minY + 40;
  const mmW = 160, mmH = 100;
  const scale = Math.min(mmW / w, mmH / h);

  return React.createElement('g', { transform: `translate(${10}, ${10})` },
    React.createElement('rect', { width: mmW, height: mmH, rx: 4, fill: 'rgba(0,0,0,0.5)', stroke: 'rgba(255,255,255,0.1)' }),
    ...graph.nodes.map((n) =>
      React.createElement('rect', {
        key: n.id,
        x: (n.x - minX + 20) * scale,
        y: (n.y - minY + 20) * scale,
        width: n.width * scale,
        height: n.height * scale,
        fill: NODE_COLORS[n.kind] || '#555',
        rx: 1,
        opacity: 0.8,
      })),
    // Viewport indicator
    React.createElement('rect', {
      x: (-viewState.panX / viewState.zoom - minX + 20) * scale,
      y: (-viewState.panY / viewState.zoom - minY + 20) * scale,
      width: (800 / viewState.zoom) * scale,
      height: (500 / viewState.zoom) * scale,
      fill: 'none', stroke: '#7aa2f7', strokeWidth: 1, rx: 1, opacity: 0.6,
    }),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 10. MODE TOOLBAR
// ══════════════════════════════════════════════════════════════════════════════

const toolbarBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px', fontSize: 12, fontWeight: active ? 600 : 400,
  border: 'none', borderRadius: 6, cursor: 'pointer',
  background: active ? 'var(--xp-blue, #7aa2f7)' : 'rgba(255,255,255,0.06)',
  color: active ? '#1a1a2e' : 'var(--xp-text, #ccc)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
  transition: 'all 0.15s',
});

const smallBtn: React.CSSProperties = {
  padding: '3px 8px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--xp-text, #ccc)',
  display: 'inline-flex', alignItems: 'center', gap: 3,
};

interface ModeToolbarProps {
  mode: AppMode;
  onModeChange: (m: AppMode) => void;
  onScan: () => void;
  onSave: () => void;
  onUndo: () => void;
  onLayout: () => void;
  onAddNode: (kind: NodeKind) => void;
  scanning: boolean;
  canUndo: boolean;
  nodeCount: number;
  edgeCount: number;
}

function ModeToolbar({ mode, onModeChange, onScan, onSave, onUndo, onLayout, onAddNode, scanning, canUndo, nodeCount, edgeCount }: ModeToolbarProps) {
  return React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
      background: 'var(--xp-surface, rgba(255,255,255,0.03))',
      flexWrap: 'wrap', minHeight: 36,
    },
  },
    // Mode buttons
    React.createElement('div', { style: { display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 } },
      React.createElement('button', { style: toolbarBtn(mode === 'view'), onClick: () => onModeChange('view') }, 'View'),
      React.createElement('button', { style: toolbarBtn(mode === 'plan'), onClick: () => onModeChange('plan') }, 'Plan'),
      React.createElement('button', { style: toolbarBtn(mode === 'execute'), onClick: () => onModeChange('execute') }, 'Execute'),
    ),
    React.createElement('div', { style: { width: 1, height: 20, background: 'rgba(255,255,255,0.1)' } }),
    // Scan
    React.createElement('button', { style: smallBtn, onClick: onScan, disabled: scanning },
      React.createElement(IconScan), scanning ? 'Scanning...' : 'Re-scan'),
    // Layout
    React.createElement('button', { style: smallBtn, onClick: onLayout },
      React.createElement(IconLayout), 'Layout'),
    // Save
    React.createElement('button', { style: smallBtn, onClick: onSave },
      React.createElement(IconSave), 'Save'),
    // Undo
    canUndo ? React.createElement('button', { style: smallBtn, onClick: onUndo },
      React.createElement(IconUndo), 'Undo') : null,
    // Plan mode: add nodes
    mode === 'plan' ? React.createElement(React.Fragment, null,
      React.createElement('div', { style: { width: 1, height: 20, background: 'rgba(255,255,255,0.1)' } }),
      ...(['component', 'hook', 'service', 'page', 'file'] as NodeKind[]).map((k) =>
        React.createElement('button', { key: k, style: smallBtn, onClick: () => onAddNode(k) },
          React.createElement(IconPlus), KIND_LABELS[k])),
    ) : null,
    // Stats
    React.createElement('div', { style: { marginLeft: 'auto', fontSize: 11, color: 'var(--xp-text-muted, #666)' } },
      `${nodeCount} nodes \u00B7 ${edgeCount} edges`),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 11. NODE PROPERTIES PANEL (Plan Mode)
// ══════════════════════════════════════════════════════════════════════════════

interface NodePropsPanelProps {
  node: ArchNode;
  onUpdate: (updates: Partial<ArchNode>) => void;
  onDelete: () => void;
  onGenerate: () => void;
}

function NodePropsPanel({ node, onUpdate, onDelete, onGenerate }: NodePropsPanelProps) {
  const [label, setLabel] = useState(node.label);
  const [desc, setDesc] = useState(node.description || '');
  const [plannedPath, setPlannedPath] = useState(node.plannedPath || '');

  useEffect(() => { setLabel(node.label); setDesc(node.description || ''); setPlannedPath(node.plannedPath || ''); }, [node.id]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'var(--xp-text, #ccc)', outline: 'none',
  };

  return React.createElement('div', {
    style: {
      padding: '10px 14px', borderTop: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
      background: 'var(--xp-surface, rgba(255,255,255,0.03))',
      display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap',
    },
  },
    // Label
    React.createElement('div', { style: { flex: '1 1 120px', minWidth: 100 } },
      React.createElement('label', { style: { fontSize: 10, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 2 } }, 'Label'),
      React.createElement('input', {
        style: inputStyle, value: label,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value),
        onBlur: () => { if (label !== node.label) onUpdate({ label }); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onUpdate({ label }); },
      }),
    ),
    // Kind
    React.createElement('div', { style: { flex: '0 0 100px' } },
      React.createElement('label', { style: { fontSize: 10, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 2 } }, 'Kind'),
      React.createElement('select', {
        style: { ...inputStyle, padding: '3px 6px' }, value: node.kind,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onUpdate({ kind: e.target.value as NodeKind }),
      }, ...Object.entries(KIND_LABELS).map(([k, l]) =>
        React.createElement('option', { key: k, value: k }, l))),
    ),
    // Planned path
    React.createElement('div', { style: { flex: '2 1 180px', minWidth: 140 } },
      React.createElement('label', { style: { fontSize: 10, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 2 } }, 'Planned Path'),
      React.createElement('input', {
        style: inputStyle, value: plannedPath, placeholder: 'e.g. src/components/MyComponent.tsx',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPlannedPath(e.target.value),
        onBlur: () => { if (plannedPath !== (node.plannedPath || '')) onUpdate({ plannedPath: plannedPath || undefined }); },
      }),
    ),
    // Description
    React.createElement('div', { style: { flex: '2 1 200px', minWidth: 140 } },
      React.createElement('label', { style: { fontSize: 10, color: 'var(--xp-text-muted)', display: 'block', marginBottom: 2 } }, 'Description'),
      React.createElement('input', {
        style: inputStyle, value: desc, placeholder: 'What this node does...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDesc(e.target.value),
        onBlur: () => { if (desc !== (node.description || '')) onUpdate({ description: desc || undefined }); },
      }),
    ),
    // Actions
    React.createElement('div', { style: { display: 'flex', gap: 4, alignSelf: 'flex-end', paddingBottom: 2 } },
      node.status === 'planned' ? React.createElement('button', {
        style: { ...smallBtn, background: 'rgba(158,206,106,0.15)', color: '#9ece6a' },
        onClick: onGenerate,
      }, React.createElement(IconAI), 'Generate') : null,
      React.createElement('button', {
        style: { ...smallBtn, background: 'rgba(247,118,142,0.15)', color: '#f7768e' },
        onClick: onDelete,
      }, React.createElement(IconTrash), 'Delete'),
    ),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 12. ADD NODE DIALOG
// ══════════════════════════════════════════════════════════════════════════════

interface AddNodeDialogProps {
  defaultKind: NodeKind;
  onAdd: (label: string, kind: NodeKind, plannedPath?: string) => void;
  onClose: () => void;
}

function AddNodeDialog({ defaultKind, onAdd, onClose }: AddNodeDialogProps) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<NodeKind>(defaultKind);
  const [path, setPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), kind, path.trim() || undefined);
    onClose();
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  };
  const dialogStyle: React.CSSProperties = {
    background: 'var(--xp-surface, #1e1e2e)', border: '1px solid var(--xp-border)',
    borderRadius: 12, padding: 20, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid var(--xp-border)',
    borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'var(--xp-text)', outline: 'none',
    marginBottom: 10, boxSizing: 'border-box',
  };

  return React.createElement('div', { style: overlayStyle, onClick: onClose },
    React.createElement('div', { style: dialogStyle, onClick: (e: React.MouseEvent) => e.stopPropagation() },
      React.createElement('div', { style: { fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'var(--xp-text)' } }, 'Add New Node'),
      React.createElement('input', {
        ref: inputRef, style: inputStyle, placeholder: 'Node name (e.g. UserProfile)',
        value: label, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); },
      }),
      React.createElement('select', {
        style: { ...inputStyle, padding: '5px 8px' }, value: kind,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setKind(e.target.value as NodeKind),
      }, ...Object.entries(KIND_LABELS).map(([k, l]) =>
        React.createElement('option', { key: k, value: k }, l))),
      React.createElement('input', {
        style: inputStyle, placeholder: 'Planned path (optional, e.g. src/components/UserProfile.tsx)',
        value: path, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPath(e.target.value),
      }),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 } },
        React.createElement('button', { style: smallBtn, onClick: onClose }, 'Cancel'),
        React.createElement('button', {
          style: { ...smallBtn, background: 'var(--xp-blue, #7aa2f7)', color: '#1a1a2e', fontWeight: 600 },
          onClick: handleSubmit,
        }, 'Add Node'),
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 13. EXECUTE MODE FILE TREE
// ══════════════════════════════════════════════════════════════════════════════

interface ExecFileTreeProps {
  api: any;
  projectRoot: string;
  nodes: ArchNode[];
  selectedNodeId: string | null;
  onFileClick: (path: string) => void;
}

function ExecFileTree({ api, projectRoot, nodes, selectedNodeId, onFileClick }: ExecFileTreeProps) {
  const [tree, setTree] = useState<FileTreeEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([projectRoot]));

  // Map of filePath → nodeId for realized nodes
  const fileToNode = useMemo(() => {
    const m = new Map<string, ArchNode>();
    for (const n of nodes) {
      if (n.filePath) m.set(n.filePath.replace(/\\/g, '/'), n);
    }
    return m;
  }, [nodes]);

  // Load root directory
  useEffect(() => {
    (async () => {
      try {
        const entries = await api.files.list(projectRoot);
        setTree(entries
          .filter((e: any) => !IGNORED_DIRS.has(e.name || getFileName(e.path)))
          .map((e: any) => ({ name: e.name || getFileName(e.path), path: e.path, is_dir: e.is_dir }))
          .sort((a: FileTreeEntry, b: FileTreeEntry) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name);
          }));
      } catch { /* ignore */ }
    })();
  }, [api, projectRoot]);

  const toggleDir = useCallback(async (dirPath: string) => {
    const newExp = new Set(expanded);
    if (newExp.has(dirPath)) {
      newExp.delete(dirPath);
    } else {
      newExp.add(dirPath);
    }
    setExpanded(newExp);
  }, [expanded]);

  const renderEntry = (entry: FileTreeEntry, depth: number): React.ReactElement | null => {
    const norm = entry.path.replace(/\\/g, '/');
    const matchedNode = fileToNode.get(norm);
    const isSelected = matchedNode && matchedNode.id === selectedNodeId;
    const isExpanded = expanded.has(entry.path);

    const itemStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', paddingLeft: 10 + depth * 14,
      fontSize: 12, cursor: 'pointer',
      background: isSelected ? 'rgba(122,162,247,0.15)' : 'transparent',
      color: 'var(--xp-text, #ccc)',
      borderRadius: 3,
    };

    return React.createElement(React.Fragment, { key: entry.path },
      React.createElement('div', {
        style: itemStyle,
        onClick: () => {
          if (entry.is_dir) toggleDir(entry.path);
          else onFileClick(norm);
        },
      },
        entry.is_dir ? React.createElement(IconChevron, { open: isExpanded }) : React.createElement('span', { style: { width: 12 } }),
        entry.is_dir ? React.createElement(IconFolder) : React.createElement(IconFile),
        React.createElement('span', { style: { flex: 1 } }, entry.name),
        matchedNode ? React.createElement('span', {
          style: {
            width: 6, height: 6, borderRadius: '50%',
            background: STATUS_COLORS[matchedNode.status],
            flexShrink: 0,
          },
        }) : null,
      ),
      isExpanded && entry.is_dir ? React.createElement(LazyDirChildren, {
        api, dirPath: entry.path, depth: depth + 1,
        fileToNode, selectedNodeId, expanded, toggleDir, onFileClick, renderEntry,
      }) : null,
    );
  };

  return React.createElement('div', { style: { overflow: 'auto', height: '100%', padding: '4px 0' } },
    tree.length === 0
      ? React.createElement('div', { style: { padding: 16, fontSize: 12, color: 'var(--xp-text-muted)' } }, 'Loading files...')
      : tree.map((e) => renderEntry(e, 0)),
  );
}

// Lazy-load directory children
function LazyDirChildren({ api, dirPath, depth, fileToNode, selectedNodeId, expanded, toggleDir, onFileClick, renderEntry }: any) {
  const [children, setChildren] = useState<FileTreeEntry[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const entries = await api.files.list(dirPath);
        setChildren(entries
          .filter((e: any) => !IGNORED_DIRS.has(e.name || getFileName(e.path)))
          .map((e: any) => ({ name: e.name || getFileName(e.path), path: e.path, is_dir: e.is_dir }))
          .sort((a: FileTreeEntry, b: FileTreeEntry) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name);
          }));
      } catch { setChildren([]); }
    })();
  }, [api, dirPath]);

  if (!children) return React.createElement('div', { style: { paddingLeft: 10 + depth * 14, fontSize: 11, color: 'var(--xp-text-muted)' } }, '...');
  return React.createElement(React.Fragment, null, ...children.map((e: FileTreeEntry) => renderEntry(e, depth)));
}

// ══════════════════════════════════════════════════════════════════════════════
// § 14. CODE PREVIEW (Syntax Highlighted)
// ══════════════════════════════════════════════════════════════════════════════

function highlightLine(line: string): React.ReactElement[] {
  // Very basic syntax highlighting via regex
  const parts: React.ReactElement[] = [];
  let remaining = line;
  let key = 0;

  // Comment
  const commentIdx = remaining.indexOf('//');
  if (commentIdx >= 0 && !remaining.slice(0, commentIdx).includes('"') && !remaining.slice(0, commentIdx).includes("'")) {
    if (commentIdx > 0) parts.push(React.createElement('span', { key: key++ }, remaining.slice(0, commentIdx)));
    parts.push(React.createElement('span', { key: key++, style: { color: '#565f89', fontStyle: 'italic' } }, remaining.slice(commentIdx)));
    return parts;
  }

  // Split by strings first
  const stringRe = /(['"`])(?:(?!\1|\\).|\\.)*?\1/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = stringRe.exec(remaining)) !== null) {
    if (m.index > lastIdx) {
      parts.push(...highlightKeywords(remaining.slice(lastIdx, m.index), key));
      key += 10;
    }
    parts.push(React.createElement('span', { key: key++, style: { color: '#9ece6a' } }, m[0]));
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < remaining.length) {
    parts.push(...highlightKeywords(remaining.slice(lastIdx), key));
  }

  return parts.length > 0 ? parts : [React.createElement('span', { key: 0 }, line)];
}

function highlightKeywords(text: string, startKey: number): React.ReactElement[] {
  const kw = /\b(import|export|from|const|let|var|function|class|interface|type|return|if|else|for|while|switch|case|break|continue|async|await|new|this|super|extends|implements|default|try|catch|throw|finally|typeof|instanceof|in|of|as|is|void|null|undefined|true|false)\b/g;
  const numRe = /\b(\d+\.?\d*)\b/g;
  const parts: React.ReactElement[] = [];
  let last = 0;
  let k = startKey;

  // Merge keyword and number matches
  const matches: { idx: number; len: number; type: 'kw' | 'num' }[] = [];
  let match: RegExpExecArray | null;
  while ((match = kw.exec(text)) !== null) matches.push({ idx: match.index, len: match[0].length, type: 'kw' });
  while ((match = numRe.exec(text)) !== null) matches.push({ idx: match.index, len: match[0].length, type: 'num' });
  matches.sort((a, b) => a.idx - b.idx);

  for (const m of matches) {
    if (m.idx < last) continue;
    if (m.idx > last) parts.push(React.createElement('span', { key: k++ }, text.slice(last, m.idx)));
    const color = m.type === 'kw' ? '#bb9af7' : '#ff9e64';
    parts.push(React.createElement('span', { key: k++, style: { color } }, text.slice(m.idx, m.idx + m.len)));
    last = m.idx + m.len;
  }
  if (last < text.length) parts.push(React.createElement('span', { key: k++ }, text.slice(last)));

  return parts;
}

function CodePreview({ code, onEdit }: { code: string; onEdit?: (newCode: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(code);

  useEffect(() => { setEditText(code); setEditing(false); }, [code]);

  if (editing) {
    return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--xp-border)' } },
        React.createElement('button', {
          style: { ...smallBtn, background: 'rgba(158,206,106,0.15)', color: '#9ece6a' },
          onClick: () => { onEdit?.(editText); setEditing(false); },
        }, React.createElement(IconSave), 'Save'),
        React.createElement('button', { style: smallBtn, onClick: () => setEditing(false) }, 'Cancel'),
      ),
      React.createElement('textarea', {
        style: {
          flex: 1, width: '100%', resize: 'none', border: 'none', outline: 'none',
          background: 'transparent', color: 'var(--xp-text)',
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace", fontSize: 12,
          padding: '8px 12px', lineHeight: 1.6, boxSizing: 'border-box',
        },
        value: editText,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value),
      }),
    );
  }

  const lines = code.split('\n');
  return React.createElement('div', { style: { height: '100%', overflow: 'auto' } },
    onEdit ? React.createElement('div', { style: { display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--xp-border)' } },
      React.createElement('button', { style: smallBtn, onClick: () => setEditing(true) },
        React.createElement(IconEdit), 'Edit'),
    ) : null,
    React.createElement('div', { style: { padding: '6px 0', fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace", fontSize: 12 } },
      ...lines.map((line, i) =>
        React.createElement('div', { key: i, style: { display: 'flex', minHeight: 20, lineHeight: '20px' } },
          React.createElement('span', {
            style: { width: 40, textAlign: 'right', paddingRight: 10, color: 'var(--xp-text-muted)', userSelect: 'none', fontSize: 11, flexShrink: 0 },
          }, String(i + 1)),
          React.createElement('span', { style: { flex: 1, whiteSpace: 'pre', overflowX: 'auto' } }, ...highlightLine(line)),
        )),
    ),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 15. MAIN ARCHITECT EDITOR
// ══════════════════════════════════════════════════════════════════════════════

function ArchitectEditor({ filePath }: { filePath: string }) {
  const apiRef = useRef<any>(null);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [], groups: [] });
  const [viewState, setViewState] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [archFile, setArchFile] = useState<ArchitectFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<GraphData[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addNodeKind, setAddNodeKind] = useState<NodeKind>('component');
  const [splitRatio] = useState(0.6);
  const [scanProgress, setScanProgress] = useState<string | null>(null);

  const graphRef = useRef(graph);
  graphRef.current = graph;

  // Get API
  useEffect(() => {
    const checkApi = () => {
      const w = window as any;
      if (w.XplorerSDK) {
        apiRef.current = { files: w.XplorerSDK.files, navigation: w.XplorerSDK.navigation, ui: w.XplorerSDK.ui };
      }
    };
    checkApi();
    const timer = setInterval(checkApi, 500);
    return () => clearInterval(timer);
  }, []);

  // Load .xparch file
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const api = apiRef.current;
        if (!api?.files?.readText) {
          // Wait a bit for API
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (apiRef.current?.files?.readText) {
          const content = await apiRef.current.files.readText(filePath);
          const data: ArchitectFile = JSON.parse(content);
          setArchFile(data);
          setGraph(data.graph);
          setViewState(data.viewState || { ...DEFAULT_VIEW });
        } else {
          setError('Extension API not available yet. Please reload.');
        }
      } catch (e: any) {
        setError('Failed to load architecture file: ' + (e?.message || e));
      }
      setLoading(false);
    })();
  }, [filePath]);

  // Set global detection flag
  useEffect(() => {
    (window as any).__xplorer_architect__ = {
      version: '1.0.0',
      getState: () => graphRef.current,
    };
    return () => { delete (window as any).__xplorer_architect__; };
  }, []);

  // Broadcast state changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('architect-state-changed', {
      detail: { projectRoot: archFile?.projectRoot, ...graph, mode: viewState.mode },
    }));
  }, [graph, viewState.mode, archFile?.projectRoot]);

  // Listen for AI events
  useEffect(() => {
    const handlePlan = (e: Event) => {
      const { nodes: newNodes, edges: newEdges } = (e as CustomEvent).detail;
      if (Array.isArray(newNodes)) {
        pushUndo();
        setGraph((prev) => ({
          ...prev,
          nodes: [...prev.nodes, ...newNodes.map((n: any) => ({ ...n, id: uid('n'), status: 'planned' as NodeStatus, width: NODE_W, height: NODE_H }))],
          edges: [...prev.edges, ...(newEdges || []).map((e: any) => ({ ...e, id: uid('e') }))],
        }));
      }
    };
    const handleExecute = async (e: Event) => {
      const { nodeId, code, filePath: fp } = (e as CustomEvent).detail;
      if (code && fp && apiRef.current?.files?.write) {
        try {
          await apiRef.current.files.write(fp, code);
          setGraph((prev) => updateNode(prev, nodeId, { status: 'realized', filePath: fp, codePreview: code.split('\n').slice(0, 10).join('\n'), generatedCode: code }));
        } catch (err: any) {
          console.error('Failed to write file:', err);
        }
      }
    };
    const handleUpdate = (e: Event) => {
      const { nodeId, updates } = (e as CustomEvent).detail;
      if (nodeId && updates) {
        pushUndo();
        setGraph((prev) => updateNode(prev, nodeId, updates));
      }
    };

    window.addEventListener('architect-plan', handlePlan);
    window.addEventListener('architect-execute-plan', handleExecute);
    window.addEventListener('architect-update-node', handleUpdate);
    return () => {
      window.removeEventListener('architect-plan', handlePlan);
      window.removeEventListener('architect-execute-plan', handleExecute);
      window.removeEventListener('architect-update-node', handleUpdate);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-29), graphRef.current]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setGraph(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!archFile || !apiRef.current?.files?.write) return;
    const data: ArchitectFile = { ...archFile, graph, viewState, metadata: { ...archFile.metadata, updatedAt: Date.now() } };
    try {
      await apiRef.current.files.write(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [archFile, graph, viewState, filePath]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!archFile) return;
    const timer = setTimeout(() => handleSave(), 3000);
    return () => clearTimeout(timer);
  }, [graph, viewState, handleSave, archFile]);

  const handleScan = useCallback(async () => {
    if (!apiRef.current || !archFile) return;
    setScanning(true);
    setScanProgress('Starting scan...');
    try {
      const result = await scanProject(apiRef.current, archFile.projectRoot, setScanProgress);
      applyLayout(result.nodes, result.edges, viewState.layoutAlgorithm);
      pushUndo();
      setGraph(result);
      setScanProgress(null);
    } catch (e: any) {
      setScanProgress('Scan failed: ' + (e?.message || e));
    }
    setScanning(false);
  }, [archFile, viewState.layoutAlgorithm, pushUndo]);

  const handleLayout = useCallback(() => {
    pushUndo();
    const newNodes = graph.nodes.map((n) => ({ ...n }));
    applyLayout(newNodes, graph.edges, viewState.layoutAlgorithm);
    setGraph({ ...graph, nodes: newNodes });
  }, [graph, viewState.layoutAlgorithm, pushUndo]);

  const handleModeChange = useCallback((mode: AppMode) => {
    setViewState((vs) => ({ ...vs, mode }));
  }, []);

  const handleNodeSelect = useCallback(async (nodeId: string | null) => {
    setViewState((vs) => ({ ...vs, selectedNodeId: nodeId }));
    if (nodeId) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      setSelectedNode(node || null);
      if (node?.filePath && apiRef.current?.files?.readText) {
        try {
          const content = await apiRef.current.files.readText(node.filePath);
          setCodeContent(content);
        } catch { setCodeContent(node.codePreview || null); }
      } else if (node?.generatedCode) {
        setCodeContent(node.generatedCode);
      } else {
        setCodeContent(node?.codePreview || null);
      }
    } else {
      setSelectedNode(null);
      setCodeContent(null);
    }
  }, [graph.nodes]);

  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    setGraph((prev) => updateNode(prev, nodeId, { x, y }));
  }, []);

  const handleAddEdge = useCallback((source: string, target: string) => {
    pushUndo();
    setGraph((prev) => addEdge(prev, source, target, 'planned'));
  }, [pushUndo]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (node?.filePath && apiRef.current?.navigation?.openInEditor) {
      apiRef.current.navigation.openInEditor(node.filePath);
    }
  }, [graph.nodes]);

  const handleAddNode = useCallback((label: string, kind: NodeKind, plannedPath?: string) => {
    pushUndo();
    const centerX = (-viewState.panX + 400) / viewState.zoom;
    const centerY = (-viewState.panY + 250) / viewState.zoom;
    setGraph((prev) => addNode(prev, kind, label, centerX, centerY, { plannedPath }));
  }, [viewState, pushUndo]);

  const handleNodeUpdate = useCallback((updates: Partial<ArchNode>) => {
    if (!selectedNode) return;
    pushUndo();
    setGraph((prev) => updateNode(prev, selectedNode.id, updates));
    setSelectedNode((prev) => prev ? { ...prev, ...updates } : prev);
  }, [selectedNode, pushUndo]);

  const handleNodeDelete = useCallback(() => {
    if (!selectedNode) return;
    pushUndo();
    setGraph((prev) => removeNode(prev, selectedNode.id));
    setSelectedNode(null);
    setCodeContent(null);
    setViewState((vs) => ({ ...vs, selectedNodeId: null }));
  }, [selectedNode, pushUndo]);

  const handleGenerate = useCallback((nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    // Get adjacent nodes for context
    const adjacentIds = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === nodeId) adjacentIds.add(e.target);
      if (e.target === nodeId) adjacentIds.add(e.source);
    }
    const adjacentNodes = graph.nodes.filter((n) => adjacentIds.has(n.id));

    window.dispatchEvent(new CustomEvent('architect-generate-request', {
      detail: {
        nodeId: node.id,
        node,
        context: {
          adjacentNodes,
          projectLanguage: archFile?.metadata.language || 'typescript',
          projectRoot: archFile?.projectRoot,
        },
      },
    }));
  }, [graph, archFile]);

  const handleCodeEdit = useCallback(async (newCode: string) => {
    if (!selectedNode?.filePath || !apiRef.current?.files?.write) return;
    try {
      await apiRef.current.files.write(selectedNode.filePath, newCode);
      setCodeContent(newCode);
      setGraph((prev) => updateNode(prev, selectedNode.id, {
        codePreview: newCode.split('\n').slice(0, 10).join('\n'),
        loc: newCode.split('\n').length,
      }));
    } catch (e) {
      console.error('Failed to save:', e);
    }
  }, [selectedNode]);

  const handleFileTreeClick = useCallback((path: string) => {
    // Find node matching this file path
    const norm = path.replace(/\\/g, '/');
    const node = graph.nodes.find((n) => n.filePath && n.filePath.replace(/\\/g, '/') === norm);
    if (node) {
      handleNodeSelect(node.id);
    }
  }, [graph.nodes, handleNodeSelect]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--xp-text-muted)', fontSize: 14 },
    }, 'Loading architecture...');
  }

  if (error) {
    return React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f7768e', fontSize: 14, padding: 24, textAlign: 'center' },
    }, error);
  }

  const isExecuteMode = viewState.mode === 'execute';
  const isPlanMode = viewState.mode === 'plan';

  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--xp-bg, #1a1a2e)', color: 'var(--xp-text, #ccc)', overflow: 'hidden', position: 'relative' },
  },
    // Toolbar
    React.createElement(ModeToolbar, {
      mode: viewState.mode,
      onModeChange: handleModeChange,
      onScan: handleScan,
      onSave: handleSave,
      onUndo: handleUndo,
      onLayout: handleLayout,
      onAddNode: (kind: NodeKind) => { setAddNodeKind(kind); setShowAddDialog(true); },
      scanning,
      canUndo: undoStack.length > 0,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }),

    // Scan progress bar
    scanProgress ? React.createElement('div', {
      style: { padding: '4px 14px', fontSize: 11, color: '#9ece6a', background: 'rgba(158,206,106,0.06)', borderBottom: '1px solid var(--xp-border)' },
    }, scanProgress) : null,

    // Main content
    isExecuteMode ? (
      // Execute mode: split view
      React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
        // Graph (top)
        React.createElement('div', { style: { flex: `0 0 ${splitRatio * 100}%`, overflow: 'hidden', position: 'relative' } },
          React.createElement(GraphCanvas, {
            graph, viewState, onViewStateChange: setViewState,
            onNodeSelect: handleNodeSelect, onNodeMove: handleNodeMove,
            onAddEdge: handleAddEdge, onNodeDoubleClick: handleNodeDoubleClick,
            onGenerate: handleGenerate,
          }),
        ),
        // Divider
        React.createElement('div', {
          style: { height: 3, background: 'var(--xp-border, rgba(255,255,255,0.1))', cursor: 'row-resize', flexShrink: 0 },
        }),
        // File tree (bottom)
        React.createElement('div', { style: { flex: 1, overflow: 'hidden', display: 'flex' } },
          React.createElement('div', { style: { flex: 1, overflow: 'auto' } },
            archFile?.projectRoot && apiRef.current ? React.createElement(ExecFileTree, {
              api: apiRef.current, projectRoot: archFile.projectRoot,
              nodes: graph.nodes, selectedNodeId: viewState.selectedNodeId,
              onFileClick: handleFileTreeClick,
            }) : React.createElement('div', { style: { padding: 16, fontSize: 12, color: 'var(--xp-text-muted)' } }, 'No project root'),
          ),
          // Code preview (right side in execute mode)
          selectedNode && codeContent ? React.createElement('div', {
            style: { width: 350, borderLeft: '1px solid var(--xp-border)', overflow: 'hidden', flexShrink: 0 },
          },
            React.createElement('div', { style: { padding: '6px 10px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--xp-border)', color: 'var(--xp-text)' } },
              selectedNode.label, ' ', React.createElement('span', { style: { fontWeight: 400, color: 'var(--xp-text-muted)', fontSize: 11 } }, KIND_LABELS[selectedNode.kind])),
            React.createElement(CodePreview, { code: codeContent, onEdit: selectedNode.filePath ? handleCodeEdit : undefined }),
          ) : null,
        ),
      )
    ) : (
      // View / Plan mode: full graph + optional side panel
      React.createElement('div', { style: { flex: 1, display: 'flex', overflow: 'hidden' } },
        // Graph
        React.createElement('div', { style: { flex: 1, overflow: 'hidden', position: 'relative' } },
          React.createElement(GraphCanvas, {
            graph, viewState, onViewStateChange: setViewState,
            onNodeSelect: handleNodeSelect, onNodeMove: handleNodeMove,
            onAddEdge: handleAddEdge, onNodeDoubleClick: handleNodeDoubleClick,
          }),
        ),
        // Code preview sidebar
        selectedNode && codeContent ? React.createElement('div', {
          style: { width: 340, borderLeft: '1px solid var(--xp-border)', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column' },
        },
          React.createElement('div', { style: { padding: '8px 12px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--xp-border)', display: 'flex', alignItems: 'center', gap: 6 } },
            React.createElement(KIND_ICONS[selectedNode.kind] || IconFile),
            selectedNode.label,
            React.createElement('span', { style: { fontWeight: 400, color: 'var(--xp-text-muted)', fontSize: 11, marginLeft: 'auto' } },
              selectedNode.loc ? `${selectedNode.loc} lines` : ''),
          ),
          React.createElement('div', { style: { flex: 1, overflow: 'hidden' } },
            React.createElement(CodePreview, { code: codeContent, onEdit: selectedNode.filePath ? handleCodeEdit : undefined }),
          ),
        ) : null,
      )
    ),

    // Plan mode: properties panel at bottom
    isPlanMode && selectedNode ? React.createElement(NodePropsPanel, {
      node: selectedNode,
      onUpdate: handleNodeUpdate,
      onDelete: handleNodeDelete,
      onGenerate: () => handleGenerate(selectedNode.id),
    }) : null,

    // Add node dialog
    showAddDialog ? React.createElement(AddNodeDialog, {
      defaultKind: addNodeKind,
      onAdd: handleAddNode,
      onClose: () => setShowAddDialog(false),
    }) : null,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 16. CODE PREVIEW SIDEBAR (for Sidebar.register)
// ══════════════════════════════════════════════════════════════════════════════

function ArchitectSidebar() {
  const [node, setNode] = useState<ArchNode | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.selectedNode) {
        setNode(detail.selectedNode);
        setCode(detail.code || detail.selectedNode.codePreview || null);
      } else {
        setNode(null);
        setCode(null);
      }
    };
    window.addEventListener('architect-selection-changed', handler);
    return () => window.removeEventListener('architect-selection-changed', handler);
  }, []);

  if (!node) {
    return React.createElement('div', {
      style: { padding: 20, color: 'var(--xp-text-muted)', fontSize: 13, textAlign: 'center' },
    },
      React.createElement('div', { style: { marginBottom: 8 } }, React.createElement(IconModule)),
      'Select a node in the Architecture Visualizer to preview its code here.',
    );
  }

  return React.createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
    React.createElement('div', { style: { padding: '8px 12px', borderBottom: '1px solid var(--xp-border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('span', {
        style: { width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[node.status], flexShrink: 0 },
      }),
      node.label,
      React.createElement('span', { style: { fontSize: 11, color: 'var(--xp-text-muted)', fontWeight: 400 } }, KIND_LABELS[node.kind]),
    ),
    node.description ? React.createElement('div', {
      style: { padding: '6px 12px', fontSize: 12, color: 'var(--xp-text-muted)', borderBottom: '1px solid var(--xp-border)' },
    }, node.description) : null,
    code ? React.createElement('div', { style: { flex: 1, overflow: 'hidden' } },
      React.createElement(CodePreview, { code }),
    ) : React.createElement('div', {
      style: { padding: 20, fontSize: 12, color: 'var(--xp-text-muted)', textAlign: 'center' },
    }, node.status === 'planned' ? 'No code yet. Generate code for this node from the graph view.' : 'No code preview available.'),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// § 17. EXTENSION REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════

// Register as editor for .xparch files
Editor.register({
  id: 'xplorer-architect',
  title: 'Architecture Visualizer',
  extensions: ['xparch'],
  priority: 50,
  render: (props: { filePath: string }) => {
    return React.createElement(ArchitectEditor, { filePath: props.filePath });
  },
});

// Register sidebar panel for code preview
Sidebar.register({
  id: 'architect-preview',
  title: 'Architect Preview',
  description: 'Code preview for Architecture Visualizer nodes',
  icon: 'layout',
  location: 'right',
  render: () => React.createElement(ArchitectSidebar),
});

// Register command to scan and create architecture file
Command.register({
  id: 'scan-architecture',
  title: 'Scan Project Architecture',
  shortcut: 'ctrl+shift+a',
  permissions: ['file:read', 'file:write', 'directory:list'],
  action: async (api: any) => {
    const currentPath = api.navigation.getCurrentPath();
    if (!currentPath || currentPath.startsWith('xplorer://')) {
      api.ui.showMessage('Navigate to a project directory first.', 'warning');
      return;
    }

    api.ui.showMessage('Scanning project architecture...', 'info');

    try {
      const result = await scanProject(api, currentPath, (msg: string) => {
        console.log('[architect]', msg);
      });

      // Apply tree layout
      applyLayout(result.nodes, result.edges, 'tree');

      const archData: ArchitectFile = {
        version: 1,
        projectRoot: currentPath,
        metadata: {
          name: getFileName(currentPath) + ' Architecture',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          language: 'typescript', // TODO: detect from file extensions
        },
        graph: result,
        viewState: { ...DEFAULT_VIEW },
      };

      // Determine separator
      const sep = currentPath.includes('\\') ? '\\' : '/';
      const archFilePath = currentPath + sep + 'architecture.xparch';
      await api.files.write(archFilePath, JSON.stringify(archData, null, 2));
      api.navigation.openInEditor(archFilePath);
      api.ui.showMessage(`Architecture map created: ${result.nodes.length} nodes, ${result.edges.length} edges`, 'info');
    } catch (e: any) {
      api.ui.showMessage('Failed to scan: ' + (e?.message || e), 'error');
    }
  },
});
