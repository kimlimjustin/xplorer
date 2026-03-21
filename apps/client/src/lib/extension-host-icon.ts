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
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  code: Code,
  eye: Eye,
  search: Search,
  terminal: Terminal,
  database: Database,
  file: FileText,
  'file-text': FileText,
  image: Image,
  music: Music,
  video: Video,
  settings: Settings,
  shield: Shield,
  globe: Globe,
  zap: Zap,
  package: Package,
  layout: Layout,
  cpu: Cpu,
  cloud: Cloud,
  bookmark: Bookmark,
  tag: Tag,
  folder: Folder,
  puzzle: Puzzle,
  'git-branch': GitBranch,
  'git-commit': GitCommit,
};

export const resolveIcon = (icon: unknown): React.ReactNode => {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'string' && ICON_MAP[icon.toLowerCase()]) {
    return React.createElement(ICON_MAP[icon.toLowerCase()], { size: 18 });
  }
  return React.createElement(Puzzle, { size: 18 });
};
