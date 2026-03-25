#!/usr/bin/env bash
# Copy only the specific Xplorer components needed for landing page demos.
# Stubs out any internal @/ imports that don't resolve.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$WEB_DIR/../client/src"
DEST="$WEB_DIR/.client-components"

rm -rf "$DEST"
mkdir -p "$DEST"

STUB='const S = (p: any) => <div {...p} />; export default S;'
HOOK_STUB='export const useStub = () => ({});'

if [ ! -d "$SRC" ]; then
  echo "⚠️  Xplorer submodule not found — creating stubs"
  mkdir -p "$DEST/components/explorer" "$DEST/components/panels" "$DEST/components/ui" "$DEST/lib"
  for f in StatusBar; do echo "$STUB" > "$DEST/components/$f.tsx"; done
  for f in LeftSidebar OperationBar FileGridItem FileGridHelpers TopBar NavigationBar; do echo "$STUB" > "$DEST/components/explorer/$f.tsx"; done
  for f in ChatPanel ChatInput ChatMessage PreviewPanel ExtensionsPanel; do echo "$STUB" > "$DEST/components/panels/$f.tsx"; done
  for f in MarkdownRenderer; do echo "$STUB" > "$DEST/components/ui/$f.tsx"; done
  exit 0
fi

echo "Copying components from $SRC ..."

# 1. Copy the specific files the web project imports via @client/
FILES=(
  "components/StatusBar.tsx"
  "components/explorer/LeftSidebar.tsx"
  "components/explorer/OperationBar.tsx"
  "components/explorer/FileGridItem.tsx"
  "components/explorer/FileGridHelpers.tsx"
  "components/explorer/TopBar.tsx"
  "components/explorer/NavigationBar.tsx"
  "components/explorer/FileGridTypes.ts"
  "components/explorer/sidebar/"
  "components/panels/ChatPanel.tsx"
  "components/panels/ChatInput.tsx"
  "components/panels/ChatMessage.tsx"
  "components/panels/chat/"
  "components/panels/PreviewPanel.tsx"
  "components/panels/ExtensionsPanel.tsx"
  "components/ui/MarkdownRenderer.tsx"
)

for f in "${FILES[@]}"; do
  src_path="$SRC/$f"
  dest_path="$DEST/$f"
  if [ -d "$src_path" ]; then
    mkdir -p "$dest_path"
    cp -r "$src_path"/* "$dest_path/" 2>/dev/null || true
    echo "  copied $f/"
  elif [ -f "$src_path" ]; then
    mkdir -p "$(dirname "$dest_path")"
    cp "$src_path" "$dest_path"
    echo "  copied $f"
  else
    mkdir -p "$(dirname "$dest_path")"
    echo "$STUB" > "${dest_path%.ts}.tsx"
    echo "  stubbed $f"
  fi
done

# 2. Copy lib/ files that the components import via @/lib/
LIB_FILES=(
  "lib/tauri-api.ts"
  "lib/tauri-api/"
  "lib/utils.ts"
  "lib/constants.ts"
  "lib/context-menu-factory.ts"
  "lib/context-menu-rules.ts"
  "lib/storage-keys.ts"
  "lib/extension-host.ts"
  "lib/extension-host-types.ts"
  "lib/extension-sandbox.ts"
  "lib/extension-sandbox-env.ts"
  "lib/extension-api-factory.ts"
  "lib/extension-lifecycle.ts"
  "lib/collections.ts"
  "lib/path-bookmarks.ts"
  "lib/saved-searches.ts"
  "lib/workspace-layouts.ts"
  "lib/folder-colors.ts"
  "lib/file-templates.ts"
  "lib/agent-service.ts"
  "lib/ai-service.ts"
)

for f in "${LIB_FILES[@]}"; do
  src_path="$SRC/$f"
  dest_path="$DEST/$f"
  if [ -d "$src_path" ]; then
    mkdir -p "$dest_path"
    cp -r "$src_path"/* "$dest_path/" 2>/dev/null || true
  elif [ -f "$src_path" ]; then
    mkdir -p "$(dirname "$dest_path")"
    cp "$src_path" "$dest_path"
  fi
done

# 3. Copy hooks/ and contexts/ that components reference
for dir in hooks contexts; do
  if [ -d "$SRC/$dir" ]; then
    mkdir -p "$DEST/$dir"
    cp -r "$SRC/$dir"/* "$DEST/$dir/" 2>/dev/null || true
    echo "  copied $dir/"
  fi
done

# 4. Copy styles and i18n
for f in styles/tokyo-night.css i18n.ts index.css; do
  if [ -f "$SRC/$f" ]; then
    mkdir -p "$DEST/$(dirname "$f")"
    cp "$SRC/$f" "$DEST/$f"
  fi
done

# 5. Copy locales
if [ -d "$SRC/locales" ]; then
  cp -r "$SRC/locales" "$DEST/locales"
fi

# 6. Stub out any files that reference feature-branch-only modules.
# These are files that exist in feature branches but not on next/main.
STUB_FILES=(
  "hooks/use-architect-context.ts"
  "components/panels/ArchitectContextBar.tsx"
  "components/explorer/ArchitectView.tsx"
  "components/explorer/architect/use-architect-scanner.ts"
  "components/explorer/architect/ArchitectSidebarTree.tsx"
  "components/explorer/architect/ArchitectCanvas.tsx"
  "components/explorer/architect/ArchitectToolbar.tsx"
  "components/explorer/architect/ArchitectAnalysis.tsx"
  "components/explorer/BrowserView.tsx"
)

for f in "${STUB_FILES[@]}"; do
  dest_path="$DEST/$f"
  if [ ! -f "$dest_path" ]; then
    mkdir -p "$(dirname "$dest_path")"
    if [[ "$f" == hooks/* ]]; then
      echo "$HOOK_STUB" > "$dest_path"
    else
      echo "$STUB" > "$dest_path"
    fi
    echo "  stubbed missing: $f"
  fi
done

# 7. Replace extension-host with a no-op stub (the real one depends on Tauri runtime)
cat > "$DEST/lib/extension-host.ts" << 'EXTHOST'
const noop = () => {};
export const extensionHost = {
  getSidebarTabs: () => [],
  getBottomTabs: () => [],
  getPanels: () => [],
  getEditors: () => [],
  getSidebarTabRenderer: () => null,
  getBottomTabRenderer: () => null,
  getContextMenuItems: () => [],
  onChange: () => noop,
  isReady: () => true,
  getLoadedExtensions: () => [],
  activateExtension: async () => {},
  deactivateExtension: async () => {},
};
export default extensionHost;
EXTHOST

cat > "$DEST/lib/extension-lifecycle.ts" << 'EXTLIFE'
export const initExtensions = async () => {};
export const loadExtension = async () => {};
EXTLIFE

# 8. Create mocks for packages not in the web project
MOCKS_DIR="$DEST/__mocks__"
mkdir -p "$MOCKS_DIR"

cat > "$MOCKS_DIR/react-i18next.ts" << 'MOCK'
export const useTranslation = () => ({
  t: (key: string) => key.split('.').pop() || key,
  i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
});
export const Trans = ({ children }: { children?: React.ReactNode }) => children;
export const initReactI18next = { type: '3rdParty', init: () => {} };
MOCK

cat > "$MOCKS_DIR/wouter.ts" << 'MOCK'
export const useLocation = () => ['/home', () => {}] as const;
export const useRoute = () => [true, {}] as const;
export const Link = (p: any) => p.children;
export const Route = (p: any) => p.children;
export const Switch = (p: any) => p.children;
MOCK

# 8. Stub named exports that components import from missing/feature-branch files
cat > "$DEST/lib/editable-files.ts" << 'NAMED'
export const isEditableFile = () => false;
NAMED

cat > "$DEST/lib/validate-filename.ts" << 'NAMED'
export const validateFileName = () => true;
NAMED

cat > "$DEST/lib/transport.ts" << 'NAMED'
export const isTauri = () => false;
export const transport = {};
NAMED

cat > "$DEST/hooks/use-architect-context.ts" << 'NAMED'
export const useArchitectContext = () => ({ isArchitectMode: false });
NAMED

cat > "$DEST/components/explorer/architect/use-architect-scanner.ts" << 'NAMED'
export const useArchitectScanner = () => ({ nodes: [], isScanning: false, progress: '' });
NAMED

cat > "$DEST/components/ui/Skeleton.tsx" << 'NAMED'
export const PreviewSkeleton = () => null;
const S = (p: any) => <div {...p} />;
export default S;
NAMED

cat > "$DEST/components/panels/PreviewActionBar.tsx" << 'NAMED'
const S = (p: any) => <div {...p} />;
export default S;
NAMED

# Stub remaining missing component/lib files
EXTRA_STUBS=(
  "components/CommandPalette.tsx"
  "components/dialogs/BatchConfirmDialog.tsx"
  "components/dialogs/EncryptionDialog.tsx"
  "components/dialogs/FileConflictDialog.tsx"
  "components/dialogs/FileDetailsDialog.tsx"
  "components/dialogs/MoveTreePreviewDialog.tsx"
  "components/dialogs/PermissionReviewDialog.tsx"
  "components/explorer/TerminalCommands.tsx"
  "components/explorer/SearchResultsPanel.tsx"
  "components/explorer/VimModeIndicator.tsx"
  "components/explorer/ThumbnailPreview.tsx"
  "components/split-view/EditorGroupPane.tsx"
  "components/ui/ContextMenu.tsx"
  "components/ui/Toast.tsx"
)

for f in "${EXTRA_STUBS[@]}"; do
  dest_path="$DEST/$f"
  if [ ! -f "$dest_path" ]; then
    mkdir -p "$(dirname "$dest_path")"
    echo 'const S = (p: any) => <div {...p} />; export default S; export {};' > "$dest_path"
  fi
done

EXTRA_TS_STUBS=(
  "extensions/advanced-selection/selection-utils.ts"
  "lib/drag-utils.ts"
  "lib/file-operation-helpers.ts"
  "lib/move-tree-preview.ts"
  "lib/paste-helpers.ts"
  "lib/preview-factory.ts"
  "lib/shortcut-utils.ts"
  "lib/theme-registry.ts"
  "lib/tour-steps.ts"
  "lib/extension-host-icon.ts"
  "lib/extension-registry.ts"
  "lib/tauri-api-types.ts"
  "types/split-view.ts"
)

for f in "${EXTRA_TS_STUBS[@]}"; do
  dest_path="$DEST/$f"
  if [ ! -f "$dest_path" ]; then
    mkdir -p "$(dirname "$dest_path")"
    echo 'export default {}; export {};' > "$dest_path"
  fi
done

echo "✅ Client components prepared"
