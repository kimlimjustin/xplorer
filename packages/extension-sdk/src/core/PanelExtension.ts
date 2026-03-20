import React from 'react';
import { Extension } from './Extension';
import { ExtensionManifest, ExtensionContext, PanelProps } from '../types';

/**
 * Base class for panel extensions that render custom UI in the sidebar
 */
export abstract class PanelExtension extends Extension {
  constructor(manifest: Omit<ExtensionManifest, 'category'>) {
    super({ ...manifest, category: 'panel' });
  }

  /**
   * Render the panel UI
   */
  abstract render(props: PanelProps): React.ReactElement;

  /**
   * Get the panel ID (defaults to extension ID)
   */
  getPanelId(): string {
    return this.manifest.id;
  }

  /**
   * Get the panel title for display
   */
  getPanelTitle(): string {
    return this.manifest.displayName || this.manifest.name;
  }

  /**
   * Get the panel icon (emoji or icon name)
   */
  getPanelIcon(): string | undefined {
    return this.manifest.icon;
  }

  /**
   * Get the panel location
   */
  getPanelLocation(): 'sidebar' | 'bottom' | 'right' {
    return 'right';
  }

  async activate(context: ExtensionContext): Promise<void> {
    this.log(`Panel "${this.getPanelTitle()}" activated`);
  }

  async deactivate(): Promise<void> {
    this.log(`Panel "${this.getPanelTitle()}" deactivated`);
  }
}
