import React from 'react';
import { resolveIcon } from './extension-host-icon';

// ── Shared types for extension tab registration ─────────────────────────────

interface TabConfig {
  id: string;
  title: string;
  icon?: string;
}

interface TabRenderProps {
  currentPath?: string;
  isActive?: boolean;
}

export interface RegisteredTab {
  id: string;
  extensionId: string;
  title: string;
  icon: React.ReactNode;
  render: (props: TabRenderProps) => React.ReactElement;
}

// ── Helper: register a sidebar tab ──────────────────────────────────────────

export const registerSidebarTab = (
  extensionObj: Record<string, unknown>,
  extensionId: string,
  registry: Map<string, RegisteredTab>,
): void => {
  if (
    typeof extensionObj.renderSidebarTab !== 'function' ||
    typeof extensionObj.getSidebarTabConfig !== 'function'
  ) {
    return;
  }
  const stConfig = (extensionObj.getSidebarTabConfig as () => TabConfig)();
  registry.set(stConfig.id, {
    id: stConfig.id,
    extensionId,
    title: stConfig.title,
    icon: resolveIcon(stConfig.icon),
    render: (props: TabRenderProps) => {
      try {
        return (extensionObj.renderSidebarTab as (props: TabRenderProps) => React.ReactElement)(
          props,
        );
      } catch (err) {
        console.error(`[ExtensionHost] Sidebar tab render failed for "${stConfig.id}":`, err);
        return React.createElement(
          'div',
          { style: { padding: 16, color: '#f87171' } },
          `Sidebar tab "${stConfig.title}" failed to render.`,
        );
      }
    },
  });
};

// ── Helper: register a bottom tab ───────────────────────────────────────────

export const registerBottomTab = (
  extensionObj: Record<string, unknown>,
  extensionId: string,
  registry: Map<string, RegisteredTab>,
): void => {
  if (
    typeof extensionObj.renderBottomTab !== 'function' ||
    typeof extensionObj.getBottomTabConfig !== 'function'
  ) {
    return;
  }
  const btConfig = (extensionObj.getBottomTabConfig as () => TabConfig)();
  registry.set(btConfig.id, {
    id: btConfig.id,
    extensionId,
    title: btConfig.title,
    icon: resolveIcon(btConfig.icon),
    render: (props: TabRenderProps) => {
      try {
        return (extensionObj.renderBottomTab as (props: TabRenderProps) => React.ReactElement)(
          props,
        );
      } catch (err) {
        console.error(`[ExtensionHost] Bottom tab render failed for "${btConfig.id}":`, err);
        return React.createElement(
          'div',
          { style: { padding: 16, color: '#f87171' } },
          `Bottom tab "${btConfig.title}" failed to render.`,
        );
      }
    },
  });
};
