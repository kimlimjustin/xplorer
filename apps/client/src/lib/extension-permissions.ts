import {
  FileEdit,
  Trash2,
  Terminal,
  Globe,
  Cpu,
  FolderMinus,
  PanelLeft,
  Eye,
  Info,
  Settings,
  Puzzle,
  FileText,
  FolderPlus,
  FolderOpen,
  Bell,
  Clipboard,
  Palette,
  History,
  type LucideIcon,
} from 'lucide-react';

export type RiskLevel = 'danger' | 'warning' | 'safe';

export interface PermissionInfo {
  id: string;
  label: string;
  description: string;
  risk: RiskLevel;
  icon: LucideIcon;
}

const PERMISSIONS: Record<string, PermissionInfo> = {
  // ── Danger ────────────────────────────────────────────────────────────────
  'file:write': {
    id: 'file:write',
    label: 'Write Files',
    description: 'Create and modify files on your computer',
    risk: 'danger',
    icon: FileEdit,
  },
  'file:delete': {
    id: 'file:delete',
    label: 'Delete Files',
    description: 'Permanently delete files from your computer',
    risk: 'danger',
    icon: Trash2,
  },
  'file:execute': {
    id: 'file:execute',
    label: 'Execute Programs',
    description: 'Run executable files and scripts on your computer',
    risk: 'danger',
    icon: Terminal,
  },
  'native:invoke': {
    id: 'native:invoke',
    label: 'Native Code',
    description: 'Run native code with full system access',
    risk: 'danger',
    icon: Cpu,
  },
  'system:commands': {
    id: 'system:commands',
    label: 'System Commands',
    description: 'Execute shell commands on your system',
    risk: 'danger',
    icon: Terminal,
  },
  'system:network': {
    id: 'system:network',
    label: 'Network Access',
    description: 'Send and receive data over the internet',
    risk: 'danger',
    icon: Globe,
  },

  // ── Warning ───────────────────────────────────────────────────────────────
  'directory:delete': {
    id: 'directory:delete',
    label: 'Delete Folders',
    description: 'Delete folders and their contents',
    risk: 'warning',
    icon: FolderMinus,
  },
  'ui:modify': {
    id: 'ui:modify',
    label: 'Modify UI',
    description: 'Change the appearance and layout of the app',
    risk: 'warning',
    icon: PanelLeft,
  },
  'system:info': {
    id: 'system:info',
    label: 'System Information',
    description: 'Read information about your operating system and hardware',
    risk: 'warning',
    icon: Info,
  },
  'xplorer:settings': {
    id: 'xplorer:settings',
    label: 'App Settings',
    description: 'Read and modify Xplorer settings',
    risk: 'warning',
    icon: Settings,
  },
  'xplorer:extensions': {
    id: 'xplorer:extensions',
    label: 'Manage Extensions',
    description: 'Install, disable, or remove other extensions',
    risk: 'warning',
    icon: Puzzle,
  },

  // ── Safe ──────────────────────────────────────────────────────────────────
  'file:read': {
    id: 'file:read',
    label: 'Read Files',
    description: 'Read file contents on your computer',
    risk: 'safe',
    icon: FileText,
  },
  'directory:create': {
    id: 'directory:create',
    label: 'Create Folders',
    description: 'Create new folders',
    risk: 'safe',
    icon: FolderPlus,
  },
  'directory:list': {
    id: 'directory:list',
    label: 'List Folder Contents',
    description: 'View files inside folders',
    risk: 'safe',
    icon: FolderOpen,
  },
  'ui:panels': {
    id: 'ui:panels',
    label: 'Add Panels',
    description: 'Add custom panels to the sidebar',
    risk: 'safe',
    icon: PanelLeft,
  },
  'ui:notifications': {
    id: 'ui:notifications',
    label: 'Show Notifications',
    description: 'Display toast messages and alerts',
    risk: 'safe',
    icon: Bell,
  },
  'ui:clipboard': {
    id: 'ui:clipboard',
    label: 'Clipboard Access',
    description: 'Read and write to the clipboard',
    risk: 'safe',
    icon: Clipboard,
  },
  'xplorer:themes': {
    id: 'xplorer:themes',
    label: 'Register Themes',
    description: 'Add custom color themes',
    risk: 'safe',
    icon: Palette,
  },
  'xplorer:history': {
    id: 'xplorer:history',
    label: 'Navigation History',
    description: 'Read browsing and navigation history',
    risk: 'safe',
    icon: History,
  },
};

const RISK_ORDER: Record<RiskLevel, number> = { danger: 0, warning: 1, safe: 2 };

export const getPermissionInfo = (permission: string) : PermissionInfo => {
  return (
    PERMISSIONS[permission] ?? {
      id: permission,
      label: permission,
      description: 'Unknown permission',
      risk: 'warning' as RiskLevel,
      icon: Eye,
    }
  );
}

/** Sort permissions by risk (danger first) then alphabetically. */
export const sortPermissions = (permissions: string[]) : PermissionInfo[] => {
  return permissions
    .map(getPermissionInfo)
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.label.localeCompare(b.label));
}

export const countByRisk = (permissions: string[]) : Record<RiskLevel, number> => {
  const counts: Record<RiskLevel, number> = { danger: 0, warning: 0, safe: 0 };
  for (const p of permissions) {
    counts[getPermissionInfo(p).risk]++;
  }
  return counts;
}
