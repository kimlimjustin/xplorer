import React from 'react';
import {
  Puzzle,
  Palette,
  Code,
  Eye,
  Search,
  Terminal,
  Database,
  FileText,
  Image,
  Music,
  Video,
  Settings,
  Shield,
  Globe,
  Zap,
  Package,
  Layout,
  Cpu,
  Cloud,
  Bookmark,
  Tag,
  Folder,
  GitBranch,
  GitCommit,
  MessageSquare,
  Target,
  BarChart3,
  AlertTriangle,
  HardDrive,
  FolderTree,
  PieChart,
  Bot,
  Sparkles,
  Paintbrush,
  Layers,
  Hash,
  List,
  CheckSquare,
  Clock,
  Download,
  Upload,
  Trash2,
  Copy,
  Scissors,
  Link,
  Lock,
  Unlock,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  // UI & Layout
  palette: Palette,
  paintbrush: Paintbrush,
  layout: Layout,
  layers: Layers,
  eye: Eye,
  // Files & Folders
  file: FileText,
  'file-text': FileText,
  folder: Folder,
  'folder-tree': FolderTree,
  // Code & Dev
  code: Code,
  terminal: Terminal,
  'git-branch': GitBranch,
  'git-commit': GitCommit,
  puzzle: Puzzle,
  package: Package,
  cpu: Cpu,
  // Search & Navigation
  search: Search,
  target: Target,
  bookmark: Bookmark,
  tag: Tag,
  hash: Hash,
  link: Link,
  // Data & Analytics
  database: Database,
  chart: PieChart,
  'pie-chart': PieChart,
  'bar-chart': BarChart3,
  'bar-chart-3': BarChart3,
  // Media
  image: Image,
  music: Music,
  video: Video,
  // Communication
  message: MessageSquare,
  'message-square': MessageSquare,
  bot: Bot,
  sparkles: Sparkles,
  // Status & Alerts
  'alert-triangle': AlertTriangle,
  shield: Shield,
  lock: Lock,
  unlock: Unlock,
  // System & Cloud
  settings: Settings,
  globe: Globe,
  cloud: Cloud,
  'hard-drive': HardDrive,
  zap: Zap,
  // Actions
  list: List,
  'check-square': CheckSquare,
  clock: Clock,
  download: Download,
  upload: Upload,
  trash: Trash2,
  copy: Copy,
  scissors: Scissors,
};

export const resolveIcon = (icon: unknown): React.ReactNode => {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'string' && ICON_MAP[icon.toLowerCase()]) {
    return React.createElement(ICON_MAP[icon.toLowerCase()], { size: 18 });
  }
  return React.createElement(Puzzle, { size: 18 });
};
