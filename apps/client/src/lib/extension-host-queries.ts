import type {
  PanelRegistration,
  FileDecoration,
  FileDecorator,
  ContextMenuEntry,
  EditorRegistration,
  PreviewRegistration,
  ExtensionFileInfo,
  CommandHandler,
  LoadedExtension,
} from './extension-host-types';

// ── Cleanup Helpers ─────────────────────────────────────────────────────────

/** Remove all registrations scoped to a specific extension ID. */
export const cleanupExtensionRegistrations = (
  id: string,
  registries: {
    panelRegistry: Map<string, PanelRegistration>;
    commandRegistry: Map<string, CommandHandler>;
    editorRegistry: Map<string, EditorRegistration>;
    previewRegistry: Map<string, PreviewRegistration>;
    decoratorRegistry: Map<string, FileDecorator>;
    contextMenuEntries: Map<string, ContextMenuEntry[]>;
    dialogRegistry: Map<string, unknown>;
    openDialogsMap: Map<string, unknown>;
    tabRendererRegistry: Map<string, unknown>;
    sidebarTabRegistry: Map<string, { extensionId: string }>;
    bottomTabRegistry: Map<string, { extensionId: string }>;
  },
) => {
  for (const [panelId, panel] of registries.panelRegistry) {
    if (panel.extensionId === id) registries.panelRegistry.delete(panelId);
  }

  for (const [cmd] of registries.commandRegistry) {
    if (
      cmd.startsWith(`${id}.`) ||
      cmd.startsWith(`state:${id}:`) ||
      cmd.startsWith(`workspace:${id}:`)
    ) {
      registries.commandRegistry.delete(cmd);
    }
  }

  for (const [editorId, editor] of registries.editorRegistry) {
    if (editor.extensionId === id) registries.editorRegistry.delete(editorId);
  }

  for (const [previewId, preview] of registries.previewRegistry) {
    if (preview.extensionId === id) registries.previewRegistry.delete(previewId);
  }

  registries.decoratorRegistry.delete(id);
  registries.contextMenuEntries.delete(id);

  for (const [dialogId] of registries.dialogRegistry) {
    if (dialogId.startsWith(`${id}:`) || dialogId.startsWith(`${id}.`)) {
      registries.dialogRegistry.delete(dialogId);
      registries.openDialogsMap.delete(dialogId);
    }
  }

  for (const [tabType] of registries.tabRendererRegistry) {
    if (tabType.startsWith(`${id}:`) || tabType.startsWith(`${id}.`) || tabType === id) {
      registries.tabRendererRegistry.delete(tabType);
    }
  }

  for (const [stId, st] of registries.sidebarTabRegistry) {
    if (st.extensionId === id) registries.sidebarTabRegistry.delete(stId);
  }

  for (const [btId, bt] of registries.bottomTabRegistry) {
    if (bt.extensionId === id) registries.bottomTabRegistry.delete(btId);
  }
};

// ── Registry Query Helpers ──────────────────────────────────────────────────

/** Find the highest-priority preview provider that can handle the given file. */
export const queryPreviewProvider = (
  previewRegistry: Map<string, PreviewRegistration>,
  extensions: Map<string, LoadedExtension>,
  file: { name: string; path: string; is_dir: boolean; size?: number },
): PreviewRegistration | null => {
  let best: PreviewRegistration | null = null;
  for (const [, preview] of previewRegistry) {
    const ext = extensions.get(preview.extensionId);
    if (!ext?.isActive) continue;
    if (preview.canPreview(file)) {
      if (!best || preview.priority > best.priority) {
        best = preview;
      }
    }
  }
  return best;
};

/** Find the best editor registration for a given file path. */
export const findEditorForFile = (
  editorRegistry: Map<string, EditorRegistration>,
  extensions: Map<string, LoadedExtension>,
  filePath: string,
): EditorRegistration | undefined => {
  const fileName = filePath.split(/[/\\]/).pop() || '';
  const lower = fileName.toLowerCase();
  let ext: string;
  if (lower.startsWith('.') && !lower.includes('.', 1)) {
    ext = lower.slice(1);
  } else {
    const parts = lower.split('.');
    ext = parts.length > 1 ? parts[parts.length - 1] : '';
  }
  const bareName = lower;

  let best: EditorRegistration | undefined;
  for (const [, editor] of editorRegistry) {
    const parentExt = extensions.get(editor.extensionId);
    if (!parentExt?.isActive) continue;
    if (editor.extensions.includes(ext) || editor.extensions.includes(bareName)) {
      if (!best || editor.priority > best.priority) {
        best = editor;
      }
    }
  }
  return best;
};

/** Get all active panels from the registry. */
export const getActivePanels = (
  panelRegistry: Map<string, PanelRegistration>,
  extensions: Map<string, LoadedExtension>,
): PanelRegistration[] => {
  const panels: PanelRegistration[] = [];
  for (const [, panel] of panelRegistry) {
    const ext = extensions.get(panel.extensionId);
    if (ext && ext.isActive) {
      panels.push(panel);
    }
  }
  return panels;
};

/** Get all file decorations for a given file from active decorators. */
export const getActiveFileDecorations = (
  decoratorRegistry: Map<string, FileDecorator>,
  extensions: Map<string, LoadedExtension>,
  file: ExtensionFileInfo,
): FileDecoration[] => {
  const decorations: FileDecoration[] = [];
  for (const [, decorator] of decoratorRegistry) {
    const ext = extensions.get(decorator.extensionId);
    if (ext?.isActive) {
      const decoration = decorator.decorate(file);
      if (decoration) {
        decorations.push(decoration);
      }
    }
  }
  return decorations;
};

/** Get all context menu entries from active extensions. */
export const getActiveContextMenuItems = (
  contextMenuEntries: Map<string, ContextMenuEntry[]>,
  extensions: Map<string, LoadedExtension>,
): ContextMenuEntry[] => {
  const items: ContextMenuEntry[] = [];
  for (const [extId, entries] of contextMenuEntries) {
    const ext = extensions.get(extId);
    if (ext?.isActive) {
      items.push(...entries);
    }
  }
  return items;
};

/** Get command palette entries with their actions. */
export const buildCommandPaletteEntries = (
  commandMetadata: Map<string, { title: string; shortcut?: string; category?: string }>,
  commandRegistry: Map<string, CommandHandler>,
): Array<{
  id: string;
  title: string;
  shortcut?: string;
  category?: string;
  action: () => void;
}> => {
  const entries: Array<{
    id: string;
    title: string;
    shortcut?: string;
    category?: string;
    action: () => void;
  }> = [];
  for (const [id, meta] of commandMetadata) {
    const handler = commandRegistry.get(id);
    if (handler) {
      entries.push({
        id: `ext:${id}`,
        title: meta.title,
        shortcut: meta.shortcut,
        category: meta.category,
        action: () => {
          handler();
        },
      });
    }
  }
  return entries;
};

/** Get active sidebar tabs. */
export const getActiveSidebarTabs = <T extends { extensionId: string }>(
  sidebarTabRegistry: Map<string, T>,
  extensions: Map<string, LoadedExtension>,
): T[] => {
  const tabs: T[] = [];
  for (const [, st] of sidebarTabRegistry) {
    const ext = extensions.get(st.extensionId);
    if (ext?.isActive) tabs.push(st);
  }
  return tabs;
};

/** Get active bottom tabs. */
export const getActiveBottomTabs = <T extends { extensionId: string }>(
  bottomTabRegistry: Map<string, T>,
  extensions: Map<string, LoadedExtension>,
): T[] => {
  const tabs: T[] = [];
  for (const [, bt] of bottomTabRegistry) {
    const ext = extensions.get(bt.extensionId);
    if (ext?.isActive) tabs.push(bt);
  }
  return tabs;
};

/** Info about a single available extension update. */
export interface ExtensionUpdateInfo {
  id: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  checksum: string;
  changelog?: string;
}

/** Check for extension updates from the marketplace. Returns available updates. */
export const checkForUpdates = async (
  installed: Array<{ manifest: { id: string; version?: string } }>,
): Promise<ExtensionUpdateInfo[]> => {
  try {
    const { TauriAPI: API } = await import('./tauri-api');
    const marketplaceUrl =
      localStorage.getItem('xplorer:marketplace-url') || 'https://xplorer.space/api';
    const extList = installed.map((pkg) => ({
      id: pkg.manifest.id,
      version: pkg.manifest.version || '0.0.0',
    }));

    const updates = await API.checkForExtensionUpdates(marketplaceUrl, extList);
    if (updates.length === 0) return [];

    return updates.map((u) => ({
      id: u.id,
      currentVersion: u.current_version,
      latestVersion: u.latest_version,
      downloadUrl: u.download_url,
      checksum: u.checksum,
      changelog: u.changelog,
    }));
  } catch {
    // Network errors are expected (offline, marketplace down) — silently ignore
    return [];
  }
};
