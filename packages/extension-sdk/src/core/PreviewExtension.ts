import React from 'react';
import { Extension } from './Extension';
import { ExtensionManifest, ExtensionContext, PreviewProps, FileEntry } from '../types';

/**
 * Base class for preview extensions that render file previews
 */
export abstract class PreviewExtension extends Extension {
  constructor(manifest: Omit<ExtensionManifest, 'category'>) {
    super({ ...manifest, category: 'preview' });
  }

  /**
   * Check if this extension can preview the given file
   */
  abstract canPreview(file: FileEntry): boolean;

  /**
   * Render the preview UI for a file
   */
  abstract render(props: PreviewProps): React.ReactElement;

  /**
   * Priority for this preview provider (higher = preferred when multiple can handle a file)
   */
  getPriority(): number {
    return 0;
  }

  async activate(context: ExtensionContext): Promise<void> {
    this.log(`Preview extension "${this.manifest.name}" activated`);
  }

  async deactivate(): Promise<void> {
    this.log(`Preview extension "${this.manifest.name}" deactivated`);
  }
}
