import React from 'react';
import i18n from '@/i18n';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';
import { ContextMenuItem } from '@/components/ui/ContextMenu';
import { PATH_SEPARATOR } from '@/lib/constants';
import { isEditableFile } from '@/lib/editable-files';
import { extensionHost } from '@/lib/extension-host';
import { getRecentEntries, type ClipboardEntry } from '@/hooks/use-clipboard-history';
import { shouldShowMenuItem } from '@/lib/context-menu-rules';
import {
  FolderOpen,
  ExternalLink,
  Wrench,
  Copy,
  Scissors,
  Clipboard,
  Pencil,
  PencilLine,
  Trash2,
  Package,
  Scale,
  Bookmark,
  BarChart3,
  MapPin,
  Terminal,
  Tag,
  StickyNote,
  MessageSquare,
  Database,
  Settings,
  Eye,
  LayoutGrid,
  Grid3X3,
  Grid2X2,
  List,
  Table,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  HardDrive,
  RefreshCw,
  Plus,
  FolderClosed,
  FileText,
  CheckSquare,
  RotateCcw,
  Lock,
  Unlock,
  ShieldAlert,
  History,
  CopyPlus,
  ClipboardCopy,
  Pin,
  FilePlus2,
  ClipboardList,
  Link2,
  FileCode2,
  Palette,
  FolderSync,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import {
  FOLDER_COLORS,
  getFolderColor,
  setFolderColor,
  removeFolderColor,
} from '@/lib/folder-colors';
export type { ContextMenuItem } from '@/components/ui/ContextMenu';

// Helper to create a context menu icon element
const mi = (Icon: LucideIcon): React.ReactNode =>
  React.createElement(Icon, { size: 14, className: 'inline-block' });

export interface ContextMenuAction {
  openInNewTab: (file: FileEntry) => void;
  openFile: (file: FileEntry) => void;
  copy: (files: FileEntry[]) => void;
  cut: (files: FileEntry[]) => void;
  paste: (targetPath: string) => void;
  delete: (files: FileEntry[]) => void;
  rename: (file: FileEntry) => void;
  createFolder: (parentPath: string) => void;
  createFile: (parentPath: string) => void;
  properties: (file: FileEntry) => void;
  refresh: () => void;
  selectAll: () => void;
  invertSelection: () => void;
  openAdvancedSelection: () => void;
  copyPath: (file: FileEntry) => void;
  openInTerminal: (path: string) => void;
  openRecycleBin: () => void;
  openWith: (file: FileEntry) => void;
  compressTo: (files: FileEntry[]) => void;
  extractHere: (file: FileEntry) => void;
  compareFiles: (file1: FileEntry, file2?: FileEntry) => void;
  markForComparison: (file: FileEntry) => void;
  bulkRename: (files: FileEntry[]) => void;
  manageTags: (file: FileEntry) => void;
  openFileDetails: (file: FileEntry, tab?: 'notes' | 'annotations' | 'metadata') => void;
  calculateFolderSize?: (file: FileEntry) => void;
  openInEditor: (file: FileEntry) => void;
  encryptFile: (file: FileEntry) => void;
  decryptFile: (file: FileEntry) => void;
  secureDelete: (files: FileEntry[]) => void;
  versionHistory: (file: FileEntry) => void;
  duplicateFiles: (files: FileEntry[]) => void;
  copyName: (file: FileEntry) => void;
  pinToSidebar: (file: FileEntry) => void;
  createNewTextFile: (parentPath: string) => void;
  createNewFile: (parentPath: string) => void;
  openTemplatePicker: (parentPath: string) => void;
  pasteFromHistory?: (targetPath: string, entry: ClipboardEntry) => void;
  createSymlink: (file: FileEntry) => void;
  openPasteRename: (files: FileEntry[]) => void;
  openBatchMetadata?: (files: FileEntry[]) => void;
  compareFolders?: (leftPath: string, rightPath: string) => void;
  setViewMode: (mode: string) => void;
  setSortBy: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
}

export interface ContextMenuConfig {
  showHidden?: boolean;
  enableCompression?: boolean;
  enableAdvanced?: boolean;
  customActions?: ContextMenuItem[];
}

/** Build a minimal FileEntry from a path string (for multi-select operations). */
const entryFromPath = (path: string) : FileEntry => {
  const name = path.split(/[/\\]/).pop() || path;
  const dotIdx = name.lastIndexOf('.');
  const extension = dotIdx > 0 ? name.slice(dotIdx + 1) : '';
  return { path, name, size: 0, modified: 0, is_dir: !extension, file_type: extension || 'folder' };
}

export class ContextMenuFactory {
  private actions: ContextMenuAction;
  private config: ContextMenuConfig;
  private clipboard: { files: FileEntry[]; operation: 'copy' | 'cut' } | null = null;
  private markedForComparison: FileEntry | null = null;

  constructor(actions: ContextMenuAction, config: ContextMenuConfig = {}) {
    this.actions = actions;
    this.config = {
      showHidden: false,
      enableCompression: true,
      enableAdvanced: true,
      ...config,
    };
  }

  // Update clipboard state
  updateClipboard(files: FileEntry[], operation: 'copy' | 'cut') {
    this.clipboard = { files, operation };
  }

  // Clear clipboard state
  clearClipboard() {
    this.clipboard = null;
  }

  // Update marked for comparison state
  markFileForComparison(file: FileEntry) {
    this.markedForComparison = file;
  }

  // Clear marked for comparison state
  clearComparisonMark() {
    this.markedForComparison = null;
  }

  // Get marked file for comparison
  getMarkedFile(): FileEntry | null {
    return this.markedForComparison;
  }

  // Build "Paste Recent" submenu items from clipboard history
  private buildPasteRecentSubmenu(targetPath: string): ContextMenuItem | null {
    const recent = getRecentEntries(5);
    if (recent.length === 0) return null;

    const formatTime = (ts: number): string => {
      const diff = Date.now() - ts;
      if (diff < 60_000) return 'just now';
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    const submenu: ContextMenuItem[] = recent.map((entry) => {
      const names =
        entry.files.length === 1
          ? entry.files[0].name
          : `${entry.files[0].name} +${entry.files.length - 1}`;
      const prefix = entry.operation === 'cut' ? 'Cut' : 'Copied';
      const label = `${prefix}: ${names} (${formatTime(entry.timestamp)})`;
      return {
        id: `paste-history-${entry.id}`,
        label,
        icon: entry.operation === 'cut' ? mi(Scissors) : mi(Copy),
        action: () => {
          if (this.actions.pasteFromHistory) {
            this.actions.pasteFromHistory(targetPath, entry);
          }
        },
      };
    });

    return {
      id: 'paste-recent',
      label: i18n.t('contextMenu.pasteRecent'),
      icon: mi(ClipboardList),
      submenu,
    };
  }

  // Get context menu items for a file/folder
  getFileContextMenu(
    file: FileEntry,
    selectedFiles: Set<string>,
    clipboard?: { files: FileEntry[]; operation: 'copy' | 'cut' } | null,
  ): ContextMenuItem[] {
    // Use provided clipboard or fallback to internal clipboard
    const currentClipboard = clipboard !== undefined ? clipboard : this.clipboard;
    const isMultiSelect = selectedFiles.size > 1;
    const selectedFilesList = Array.from(selectedFiles);

    const items: ContextMenuItem[] = [];

    // Open actions
    if (!isMultiSelect) {
      items.push({
        id: 'open',
        label: i18n.t('contextMenu.open'),
        icon: mi(FolderOpen),
        action: () => this.actions.openFile(file),
      });

      items.push({
        id: 'open-new-tab',
        label: i18n.t('contextMenu.openInNewTab'),
        icon: mi(ExternalLink),
        action: () => this.actions.openInNewTab(file),
      });

      if (!file.is_dir && isEditableFile(file)) {
        items.push({
          id: 'open-in-editor',
          label: i18n.t('contextMenu.edit'),
          icon: mi(Pencil),
          action: () => this.actions.openInEditor(file),
        });
      }

      items.push({ id: 'sep1', label: '', separator: true });
    }

    // Edit actions
    items.push({
      id: 'cut',
      label: isMultiSelect ? i18n.t('contextMenu.cutItems', { count: selectedFiles.size }) : i18n.t('contextMenu.cut'),
      icon: mi(Scissors),
      shortcut: 'Ctrl+X',
      action: () => {
        const filesToCut = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
        this.actions.cut(filesToCut);
        this.updateClipboard(filesToCut, 'cut');
      },
    });

    items.push({
      id: 'copy',
      label: isMultiSelect ? i18n.t('contextMenu.copyItems', { count: selectedFiles.size }) : i18n.t('contextMenu.copy'),
      icon: mi(Copy),
      shortcut: 'Ctrl+C',
      action: () => {
        const filesToCopy = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
        this.actions.copy(filesToCopy);
        this.updateClipboard(filesToCopy, 'copy');
      },
    });

    items.push({
      id: 'paste',
      label: i18n.t('contextMenu.paste'),
      icon: mi(Clipboard),
      shortcut: 'Ctrl+V',
      disabled: !currentClipboard || currentClipboard.files.length === 0,
      action: () => {
        const targetPath = file.is_dir
          ? file.path
          : file.path
              .split(/[\\/]/)
              .slice(0, -1)
              .join(PATH_SEPARATOR);
        this.actions.paste(targetPath);
      },
    });

    // Paste Recent submenu (clipboard history)
    {
      const pasteTarget = file.is_dir
        ? file.path
        : file.path
            .split(/[\\/]/)
            .slice(0, -1)
            .join(PATH_SEPARATOR);
      const pasteRecentItem = this.buildPasteRecentSubmenu(pasteTarget);
      if (pasteRecentItem) items.push(pasteRecentItem);
    }

    // Duplicate
    items.push({
      id: 'duplicate',
      label: isMultiSelect ? i18n.t('contextMenu.duplicateItems', { count: selectedFiles.size }) : i18n.t('contextMenu.duplicate'),
      icon: mi(CopyPlus),
      shortcut: 'Ctrl+D',
      action: () => {
        const filesToDuplicate = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
        this.actions.duplicateFiles(filesToDuplicate);
      },
    });

    items.push({ id: 'sep2', label: '', separator: true });

    // Delete and rename
    if (!isMultiSelect) {
      items.push({
        id: 'rename',
        label: i18n.t('contextMenu.rename'),
        icon: mi(Pencil),
        shortcut: 'F2',
        action: () => this.actions.rename(file),
      });
    }

    if (isMultiSelect) {
      items.push({
        id: 'bulk-rename',
        label: i18n.t('contextMenu.bulkRename', { count: selectedFiles.size }),
        icon: mi(PencilLine),
        action: () => {
          const filesToRename = selectedFilesList.map(entryFromPath);
          this.actions.bulkRename(filesToRename);
        },
      });

      items.push({
        id: 'paste-rename',
        label: i18n.t('contextMenu.pasteAndRename', { count: selectedFiles.size }),
        icon: mi(ClipboardList),
        action: () => {
          const filesToRename = selectedFilesList.map(entryFromPath);
          this.actions.openPasteRename(filesToRename);
        },
      });
    }

    items.push({
      id: 'delete',
      label: isMultiSelect ? i18n.t('contextMenu.deleteItems', { count: selectedFiles.size }) : i18n.t('contextMenu.delete'),
      icon: mi(Trash2),
      shortcut: 'Delete',
      action: () => {
        const filesToDelete = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
        this.actions.delete(filesToDelete);
      },
    });

    items.push({ id: 'sep3', label: '', separator: true });

    // Archive submenu (compression + extraction)
    if (this.config.enableCompression) {
      const canCompress = isMultiSelect || !file.is_dir;
      const canExtract =
        !isMultiSelect &&
        !file.is_dir &&
        /\.(zip|rar|7z|tar|gz|bz2|xz|tgz|tbz2|txz)$/i.test(file.name);

      if (canCompress || canExtract) {
        const archiveSubmenu: ContextMenuItem[] = [];
        if (canCompress) {
          archiveSubmenu.push({
            id: 'compress',
            label: i18n.t('contextMenu.addToArchive'),
            icon: mi(Package),
            action: () => {
              const filesToCompress = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
              this.actions.compressTo(filesToCompress);
            },
          });
        }
        if (canExtract) {
          archiveSubmenu.push({
            id: 'extract',
            label: i18n.t('contextMenu.extractHere'),
            icon: mi(FolderOpen),
            action: () => this.actions.extractHere(file),
          });
        }
        items.push({
          id: 'archive',
          label: i18n.t('contextMenu.archive'),
          icon: mi(Package),
          submenu: archiveSubmenu,
        });
      }
    }

    // --- "More" submenu: less-common actions grouped together ---
    const moreItems: ContextMenuItem[] = [];

    // Open with... (single file only)
    if (!isMultiSelect && !file.is_dir) {
      moreItems.push({
        id: 'open-with',
        label: i18n.t('contextMenu.openWith'),
        icon: mi(Wrench),
        action: () => this.actions.openWith(file),
      });
    }

    // Create Link (single item only)
    if (!isMultiSelect) {
      moreItems.push({
        id: 'create-symlink',
        label: i18n.t('contextMenu.createLink'),
        icon: mi(Link2),
        action: () => this.actions.createSymlink(file),
      });
    }

    // Secure Delete
    moreItems.push({
      id: 'secure-delete',
      label: isMultiSelect ? i18n.t('contextMenu.secureDeleteItems', { count: selectedFiles.size }) : i18n.t('contextMenu.secureDelete'),
      icon: mi(ShieldAlert),
      action: () => {
        const filesToSecureDelete = isMultiSelect ? selectedFilesList.map(entryFromPath) : [file];
        this.actions.secureDelete(filesToSecureDelete);
      },
    });

    // Encrypt / Decrypt (single file only, not directories)
    if (!isMultiSelect && !file.is_dir) {
      const isEnc = /\.enc$/i.test(file.name);
      if (isEnc) {
        moreItems.push({
          id: 'decrypt',
          label: i18n.t('contextMenu.decrypt'),
          icon: mi(Unlock),
          action: () => this.actions.decryptFile(file),
        });
      } else {
        moreItems.push({
          id: 'encrypt',
          label: i18n.t('contextMenu.encrypt'),
          icon: mi(Lock),
          action: () => this.actions.encryptFile(file),
        });
      }
    }

    // Compare submenu (only for files, not directories)
    if (!file.is_dir) {
      const canCompare = selectedFiles.size <= 2;

      if (canCompare) {
        const compareSubmenu: ContextMenuItem[] = [];

        if (selectedFiles.size === 2) {
          compareSubmenu.push({
            id: 'compare-selected',
            label: i18n.t('contextMenu.compareSelected'),
            icon: mi(Scale),
            action: () => {
              const filesList = selectedFilesList.map(entryFromPath);
              this.actions.compareFiles(filesList[0], filesList[1]);
            },
          });
        } else {
          if (this.markedForComparison && this.markedForComparison.path !== file.path) {
            compareSubmenu.push({
              id: 'compare-with-marked',
              label: i18n.t('contextMenu.compareWith', { name: this.markedForComparison.name }),
              icon: mi(Scale),
              action: () => {
                this.actions.compareFiles(file, this.markedForComparison!);
                this.clearComparisonMark();
              },
            });
          }

          compareSubmenu.push({
            id: 'mark-for-comparison',
            label:
              this.markedForComparison?.path === file.path
                ? i18n.t('contextMenu.unmarkForComparison')
                : i18n.t('contextMenu.markForComparison'),
            icon: mi(Bookmark),
            action: () => {
              if (this.markedForComparison?.path === file.path) {
                this.clearComparisonMark();
              } else {
                this.markFileForComparison(file);
                this.actions.markForComparison(file);
              }
            },
          });

          compareSubmenu.push({
            id: 'compare-with-other',
            label: i18n.t('contextMenu.compareWithOther'),
            icon: mi(BarChart3),
            action: () => this.actions.compareFiles(file),
          });
        }

        moreItems.push({
          id: 'compare',
          label: i18n.t('contextMenu.compare'),
          icon: mi(Scale),
          submenu: compareSubmenu,
        });
      }
    }

    // Directory-specific advanced actions
    if (this.config.enableAdvanced && file.is_dir) {
      moreItems.push({
        id: 'open-terminal',
        label: i18n.t('contextMenu.openInTerminal'),
        icon: mi(Terminal),
        action: () => this.actions.openInTerminal(file.path),
      });

      if (this.actions.calculateFolderSize) {
        moreItems.push({
          id: 'calculate-folder-size',
          label: i18n.t('contextMenu.calculateFolderSize'),
          icon: mi(HardDrive),
          action: () => this.actions.calculateFolderSize!(file),
        });
      }

      // Compare Folders: when 2 dirs selected, or single dir selected
      if (this.actions.compareFolders) {
        if (isMultiSelect && selectedFiles.size === 2) {
          const selectedPaths = selectedFilesList;
          moreItems.push({
            id: 'compare-folders',
            label: i18n.t('contextMenu.compareSelectedFolders'),
            icon: mi(FolderSync),
            action: () => {
              this.actions.compareFolders!(selectedPaths[0], selectedPaths[1]);
            },
          });
        } else if (!isMultiSelect) {
          moreItems.push({
            id: 'compare-folders',
            label: i18n.t('contextMenu.compareFolders'),
            icon: mi(FolderSync),
            action: () => {
              this.actions.compareFolders!(file.path, '');
            },
          });
        }
      }
    }

    // File Details submenu (single select)
    if (!isMultiSelect) {
      moreItems.push({
        id: 'file-details',
        label: i18n.t('contextMenu.fileDetails'),
        icon: mi(FileText),
        submenu: [
          {
            id: 'details-notes',
            label: i18n.t('contextMenu.notes'),
            icon: mi(StickyNote),
            action: () => this.actions.openFileDetails(file, 'notes'),
          },
          {
            id: 'details-annotations',
            label: i18n.t('contextMenu.annotations'),
            icon: mi(MessageSquare),
            action: () => this.actions.openFileDetails(file, 'annotations'),
          },
          {
            id: 'details-metadata',
            label: i18n.t('contextMenu.metadata'),
            icon: mi(Database),
            action: () => this.actions.openFileDetails(file, 'metadata'),
          },
        ],
      });

      moreItems.push({
        id: 'manage-tags',
        label: i18n.t('contextMenu.tags'),
        icon: mi(Tag),
        action: () => this.actions.manageTags(file),
      });

      moreItems.push({
        id: 'copy-path',
        label: i18n.t('contextMenu.copyPath'),
        icon: mi(MapPin),
        action: () => this.actions.copyPath(file),
      });

      moreItems.push({
        id: 'copy-name',
        label: i18n.t('contextMenu.copyName'),
        icon: mi(ClipboardCopy),
        action: () => this.actions.copyName(file),
      });

      if (!file.is_dir) {
        moreItems.push({
          id: 'version-history',
          label: i18n.t('contextMenu.versionHistory'),
          icon: mi(History),
          action: () => this.actions.versionHistory(file),
        });
      }

      if (!file.is_dir) {
        moreItems.push({
          id: 'add-bookmark',
          label: i18n.t('contextMenu.addToBookmarks'),
          icon: mi(Bookmark),
          action: async () => {
            try {
              await TauriAPI.addBookmark(file.path, file.name);
              window.dispatchEvent(new CustomEvent('bookmarks-changed'));
            } catch (error) {
              console.error('Failed to add bookmark:', error);
            }
          },
        });
      }

      // Open in Terminal (for files, opens parent directory)
      if (!file.is_dir) {
        moreItems.push({
          id: 'open-terminal',
          label: i18n.t('contextMenu.openInTerminal'),
          icon: mi(Terminal),
          action: () => {
            const parentDir = file.path
              .split(/[\\/]/)
              .slice(0, -1)
              .join(PATH_SEPARATOR);
            this.actions.openInTerminal(parentDir);
          },
        });
      }
    }

    // Batch Metadata (multi-select only, 2+ files)
    if (isMultiSelect && this.actions.openBatchMetadata) {
      const batchFiles = selectedFilesList.map(entryFromPath);
      moreItems.push({
        id: 'batch-metadata',
        label: i18n.t('contextMenu.editMetadata'),
        icon: mi(Tag),
        action: () => this.actions.openBatchMetadata!(batchFiles),
      });
    }

    // Pin to Sidebar (folders only)
    if (!isMultiSelect && file.is_dir) {
      moreItems.push({
        id: 'pin-to-sidebar',
        label: i18n.t('contextMenu.pinToSidebar'),
        icon: mi(Pin),
        action: () => this.actions.pinToSidebar(file),
      });
    }

    // Set Folder Color (folders only, single select)
    if (!isMultiSelect && file.is_dir) {
      const currentFolderColor = getFolderColor(file.path);
      const colorSubmenu: ContextMenuItem[] = FOLDER_COLORS.map((c) => ({
        id: `folder-color-${c.id}`,
        label: c.label,
        icon: React.createElement('span', {
          style: {
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: c.hex,
            border:
              currentFolderColor?.colorId === c.id
                ? '2px solid #fff'
                : '1px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          },
        }),
        action: () => {
          setFolderColor(file.path, c.id, c.label);
        },
      }));

      if (currentFolderColor) {
        colorSubmenu.push({ id: 'folder-color-sep', label: '', separator: true });
        colorSubmenu.push({
          id: 'folder-color-remove',
          label: i18n.t('contextMenu.removeColor'),
          icon: React.createElement('span', {
            style: {
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.4)',
              position: 'relative',
            },
          }),
          action: () => {
            removeFolderColor(file.path);
          },
        });
      }

      moreItems.push({
        id: 'folder-color',
        label: i18n.t('contextMenu.setFolderColor'),
        icon: mi(Palette),
        submenu: colorSubmenu,
      });
    }

    // Properties
    moreItems.push({
      id: 'properties',
      label: i18n.t('common.properties'),
      icon: mi(Settings),
      shortcut: 'Alt+Enter',
      action: () => this.actions.properties(file),
    });

    // Add the "More" submenu if there are items to show
    if (moreItems.length > 0) {
      items.push({
        id: 'more',
        label: i18n.t('contextMenu.more'),
        icon: mi(MoreHorizontal),
        submenu: moreItems,
      });
    }

    // Add actions from extension host
    const extensionItems = extensionHost.getContextMenuItems({
      file,
      selectedFiles: selectedFiles || [],
    });
    if (extensionItems.length > 0) {
      items.push({ id: 'sep-extensions', label: '', separator: true });
      for (const extItem of extensionItems) {
        items.push({
          id: extItem.id,
          label: extItem.label,
          icon: extItem.icon,
          action: () => extItem.action(file, selectedFiles),
        });
      }
    }

    // Add custom actions from extensions
    if (this.config.customActions && this.config.customActions.length > 0) {
      items.push({ id: 'sep-custom', label: '', separator: true });
      items.push(...this.config.customActions);
    }

    return filterItemsByRules(items, file);
  }

  // Get context menu items for empty space (folder background)
  getEmptySpaceContextMenu(
    currentPath: string,
    clipboard?: { files: FileEntry[]; operation: 'copy' | 'cut' } | null,
  ): ContextMenuItem[] {
    // Use provided clipboard or fallback to internal clipboard
    const currentClipboard = clipboard !== undefined ? clipboard : this.clipboard;
    const items: ContextMenuItem[] = [];

    // View options
    items.push({
      id: 'view',
      label: i18n.t('contextMenu.view'),
      icon: mi(Eye),
      submenu: [
        {
          id: 'view-large',
          label: i18n.t('contextMenu.largeIcons'),
          icon: mi(LayoutGrid),
          action: () => this.actions.setViewMode('large'),
        },
        {
          id: 'view-medium',
          label: i18n.t('contextMenu.mediumIcons'),
          icon: mi(Grid3X3),
          action: () => this.actions.setViewMode('medium'),
        },
        {
          id: 'view-small',
          label: i18n.t('contextMenu.smallIcons'),
          icon: mi(Grid2X2),
          action: () => this.actions.setViewMode('small'),
        },
        {
          id: 'view-list',
          label: i18n.t('contextMenu.list'),
          icon: mi(List),
          action: () => this.actions.setViewMode('list'),
        },
        {
          id: 'view-details',
          label: i18n.t('contextMenu.details'),
          icon: mi(Table),
          action: () => this.actions.setViewMode('details'),
        },
      ],
    });

    items.push({
      id: 'sort',
      label: i18n.t('contextMenu.sortBy'),
      icon: mi(ArrowUpDown),
      submenu: [
        {
          id: 'sort-name',
          label: i18n.t('contextMenu.name'),
          icon: mi(ArrowDownAZ),
          action: () => this.actions.setSortBy('name'),
        },
        {
          id: 'sort-date',
          label: i18n.t('contextMenu.dateModified'),
          icon: mi(Calendar),
          action: () => this.actions.setSortBy('dateModified'),
        },
        {
          id: 'sort-size',
          label: i18n.t('contextMenu.size'),
          icon: mi(HardDrive),
          action: () => this.actions.setSortBy('size'),
        },
        {
          id: 'sort-type',
          label: i18n.t('contextMenu.type'),
          icon: mi(Tag),
          action: () => this.actions.setSortBy('type'),
        },
        { id: 'sort-sep', label: '', separator: true },
        {
          id: 'sort-asc',
          label: i18n.t('contextMenu.ascending'),
          icon: mi(ArrowUpAZ),
          action: () => this.actions.setSortOrder('asc'),
        },
        {
          id: 'sort-desc',
          label: i18n.t('contextMenu.descending'),
          icon: mi(ArrowDownAZ),
          action: () => this.actions.setSortOrder('desc'),
        },
      ],
    });

    items.push({
      id: 'refresh',
      label: i18n.t('common.refresh'),
      icon: mi(RefreshCw),
      shortcut: 'F5',
      action: () => this.actions.refresh(),
    });

    items.push({ id: 'sep1', label: '', separator: true });

    // Paste
    items.push({
      id: 'paste',
      label: i18n.t('contextMenu.paste'),
      icon: mi(Clipboard),
      shortcut: 'Ctrl+V',
      disabled: !currentClipboard || currentClipboard.files.length === 0,
      action: () => this.actions.paste(currentPath),
    });

    // Paste Recent submenu (clipboard history)
    {
      const pasteRecentItem = this.buildPasteRecentSubmenu(currentPath);
      if (pasteRecentItem) items.push(pasteRecentItem);
    }

    items.push({ id: 'sep2', label: '', separator: true });

    // New items
    const newSubmenu: ContextMenuItem[] = [
      {
        id: 'new-folder',
        label: i18n.t('contextMenu.newFolder'),
        icon: mi(FolderClosed),
        shortcut: 'Ctrl+Shift+N',
        action: () => this.actions.createFolder(currentPath),
      },
      {
        id: 'new-text-file',
        label: i18n.t('contextMenu.textFile'),
        icon: mi(FileText),
        action: () => this.actions.createNewTextFile(currentPath),
      },
      {
        id: 'new-file',
        label: i18n.t('contextMenu.newFile'),
        icon: mi(FilePlus2),
        action: () => this.actions.createNewFile(currentPath),
      },
      {
        id: 'new-from-template',
        label: i18n.t('contextMenu.fromTemplate'),
        icon: mi(FileCode2),
        action: () => this.actions.openTemplatePicker(currentPath),
      },
    ];

    // Add "New Chat" option — available in any folder
    newSubmenu.push({
      id: 'new-chat',
      label: i18n.t('contextMenu.chat'),
      icon: mi(MessageSquare),
      action: async () => {
        try {
          await TauriAPI.createChatFile(currentPath);
          this.actions.refresh();
        } catch (error) {
          console.error('Failed to create chat file:', error);
        }
      },
    });

    items.push({
      id: 'new',
      label: i18n.t('common.new'),
      icon: mi(Plus),
      submenu: newSubmenu,
    });

    items.push({ id: 'sep3', label: '', separator: true });

    // Selection actions
    items.push({
      id: 'select-all',
      label: i18n.t('contextMenu.selectAll'),
      icon: mi(CheckSquare),
      shortcut: 'Ctrl+A',
      action: () => this.actions.selectAll(),
    });

    items.push({
      id: 'invert-selection',
      label: i18n.t('contextMenu.invertSelection'),
      icon: mi(RotateCcw),
      shortcut: 'Ctrl+Shift+A',
      action: () => this.actions.invertSelection(),
    });

    if (this.config.enableAdvanced) {
      items.push({
        id: 'advanced-selection',
        label: i18n.t('contextMenu.selectBy'),
        icon: mi(Settings),
        action: () => this.actions.openAdvancedSelection(),
      });
    }

    items.push({ id: 'sep-selection', label: '', separator: true });

    // Terminal
    if (this.config.enableAdvanced) {
      items.push({
        id: 'open-terminal',
        label: i18n.t('contextMenu.openInTerminal'),
        icon: mi(Terminal),
        action: () => this.actions.openInTerminal(currentPath),
      });
    }

    // Recycle Bin
    items.push({
      id: 'open-recycle-bin',
      label: i18n.t('contextMenu.openRecycleBin'),
      icon: mi(Trash2),
      action: () => this.actions.openRecycleBin(),
    });

    // Bookmark current folder
    items.push({
      id: 'add-bookmark-folder',
      label: i18n.t('contextMenu.bookmarkFolder'),
      icon: mi(Bookmark),
      action: async () => {
        try {
          const folderName =
            currentPath
              .split(/[\\/]/)
              .filter(Boolean)
              .pop() || currentPath;
          await TauriAPI.addBookmark(currentPath, folderName);
          window.dispatchEvent(new CustomEvent('bookmarks-changed'));
        } catch (error) {
          console.error('Failed to bookmark folder:', error);
        }
      },
    });

    // Add custom actions from extensions
    if (this.config.customActions && this.config.customActions.length > 0) {
      items.push({ id: 'sep-custom', label: '', separator: true });
      items.push(...this.config.customActions);
    }

    return items;
  }
}

/**
 * Filter a flat list of context menu items through user-configured rules.
 * - Separators are never filtered directly; they are removed if they
 *   become leading, trailing, or consecutive after filtering.
 * - Submenu children are recursively filtered; empty submenus are removed.
 */
const filterItemsByRules = (items: ContextMenuItem[], file: FileEntry): ContextMenuItem[] => {
  const filtered: ContextMenuItem[] = [];

  for (const item of items) {
    // Separators are kept temporarily — cleaned up below
    if (item.separator) {
      filtered.push(item);
      continue;
    }

    // Check if this item (by id) should be shown per the user rules
    if (!shouldShowMenuItem(item.id, file)) continue;

    // Recursively filter submenu children
    if (item.submenu && item.submenu.length > 0) {
      const filteredSub = filterItemsByRules(item.submenu, file);
      if (filteredSub.length === 0) continue; // drop empty submenu
      filtered.push({ ...item, submenu: filteredSub });
    } else {
      filtered.push(item);
    }
  }

  // Clean up separators: no leading, no trailing, no consecutive
  const cleaned: ContextMenuItem[] = [];
  for (const item of filtered) {
    if (item.separator) {
      if (cleaned.length === 0) continue; // skip leading
      if (cleaned[cleaned.length - 1]?.separator) continue; // skip consecutive
      cleaned.push(item);
    } else {
      cleaned.push(item);
    }
  }
  // Remove trailing separator
  while (cleaned.length > 0 && cleaned[cleaned.length - 1]?.separator) {
    cleaned.pop();
  }

  return cleaned;
};

// Extension interface for plugins to add custom context menu items
export interface ContextMenuExtension {
  id: string;
  name: string;
  getFileActions?: (file: FileEntry, selectedFiles: Set<string>) => ContextMenuItem[];
  getEmptySpaceActions?: (currentPath: string) => ContextMenuItem[];
}

// Registry for context menu extensions
export class ContextMenuExtensionRegistry {
  private extensions: Map<string, ContextMenuExtension> = new Map();

  register(extension: ContextMenuExtension) {
    this.extensions.set(extension.id, extension);
  }

  unregister(extensionId: string) {
    this.extensions.delete(extensionId);
  }

  getFileActions(file: FileEntry, selectedFiles: Set<string>): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    for (const extension of this.extensions.values()) {
      if (extension.getFileActions) {
        const extensionItems = extension.getFileActions(file, selectedFiles);
        items.push(...extensionItems);
      }
    }

    return items;
  }

  getEmptySpaceActions(currentPath: string): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    for (const extension of this.extensions.values()) {
      if (extension.getEmptySpaceActions) {
        const extensionItems = extension.getEmptySpaceActions(currentPath);
        items.push(...extensionItems);
      }
    }

    return items;
  }
}

// Global registry instance
export const contextMenuRegistry = new ContextMenuExtensionRegistry();
