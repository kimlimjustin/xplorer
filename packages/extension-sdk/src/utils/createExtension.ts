import React from 'react';
import { Extension } from '../core/Extension';
import { PanelExtension } from '../core/PanelExtension';
import { PreviewExtension } from '../core/PreviewExtension';
import { ActionExtension } from '../core/ActionExtension';
import { ThemeExtension } from '../core/ThemeExtension';
import {
  ExtensionManifest,
  ExtensionContext,
  PanelProps,
  PreviewProps,
  FileEntry,
  ActionMenuItem,
  Theme,
} from '../types';

interface CreatePanelConfig {
  manifest: Omit<ExtensionManifest, 'category'>;
  activate?: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  render: (props: PanelProps) => React.ReactElement;
  panelLocation?: 'sidebar' | 'bottom' | 'right';
}

interface CreatePreviewConfig {
  manifest: Omit<ExtensionManifest, 'category'>;
  activate?: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  canPreview: (file: FileEntry) => boolean;
  render: (props: PreviewProps) => React.ReactElement;
  priority?: number;
}

interface CreateActionConfig {
  manifest: Omit<ExtensionManifest, 'category'>;
  activate?: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  getActions: () => ActionMenuItem[];
}

interface CreateThemeConfig {
  manifest: Omit<ExtensionManifest, 'category'>;
  getTheme: () => Theme;
}

type CreateExtensionConfig =
  | ({ type: 'panel' } & CreatePanelConfig)
  | ({ type: 'preview' } & CreatePreviewConfig)
  | ({ type: 'action' } & CreateActionConfig)
  | ({ type: 'theme' } & CreateThemeConfig);

/**
 * Factory function to create extensions without subclassing
 */
export const createExtension = (config: CreateExtensionConfig): Extension => {
  switch (config.type) {
    case 'panel': {
      const { manifest, activate, deactivate, render, panelLocation } = config;
      return new (class extends PanelExtension {
        constructor() {
          super(manifest);
        }
        render(props: PanelProps) {
          return render(props);
        }
        getPanelLocation() {
          return panelLocation || ('right' as const);
        }
        async activate(ctx: ExtensionContext) {
          await super.activate(ctx);
          if (activate) await activate(ctx);
        }
        async deactivate() {
          if (deactivate) await deactivate();
          await super.deactivate();
        }
      })();
    }

    case 'preview': {
      const { manifest, activate, deactivate, canPreview, render, priority } = config;
      return new (class extends PreviewExtension {
        constructor() {
          super(manifest);
        }
        canPreview(file: FileEntry) {
          return canPreview(file);
        }
        render(props: PreviewProps) {
          return render(props);
        }
        getPriority() {
          return priority ?? 0;
        }
        async activate(ctx: ExtensionContext) {
          await super.activate(ctx);
          if (activate) await activate(ctx);
        }
        async deactivate() {
          if (deactivate) await deactivate();
          await super.deactivate();
        }
      })();
    }

    case 'action': {
      const { manifest, activate, deactivate, getActions } = config;
      return new (class extends ActionExtension {
        constructor() {
          super(manifest);
        }
        getActions() {
          return getActions();
        }
        async activate(ctx: ExtensionContext) {
          await super.activate(ctx);
          if (activate) await activate(ctx);
        }
        async deactivate() {
          if (deactivate) await deactivate();
          await super.deactivate();
        }
      })();
    }

    case 'theme': {
      const { manifest, getTheme } = config;
      return new (class extends ThemeExtension {
        constructor() {
          super(manifest);
        }
        getTheme() {
          return getTheme();
        }
      })();
    }
  }
};
