// Mock extension-permissions for web landing page demos

import { Eye, type LucideIcon } from 'lucide-react';

export type RiskLevel = 'danger' | 'warning' | 'safe';

export interface PermissionInfo {
  id: string;
  label: string;
  description: string;
  risk: RiskLevel;
  icon: LucideIcon;
}

export function getPermissionInfo(permission: string): PermissionInfo {
  return {
    id: permission,
    label: permission,
    description: 'Permission',
    risk: 'safe',
    icon: Eye,
  };
}

export function sortPermissions(permissions: string[]): PermissionInfo[] {
  return permissions.map(getPermissionInfo);
}

export function countByRisk(permissions: string[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { danger: 0, warning: 0, safe: 0 };
  for (const p of permissions) {
    counts[getPermissionInfo(p).risk]++;
  }
  return counts;
}
