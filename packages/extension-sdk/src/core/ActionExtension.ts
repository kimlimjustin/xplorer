import { Extension } from './Extension';
import { ExtensionManifest, ExtensionContext, ActionMenuItem } from '../types';

/**
 * Base class for action extensions that add context menu items and commands
 */
export abstract class ActionExtension extends Extension {
  constructor(manifest: Omit<ExtensionManifest, 'category'>) {
    super({ ...manifest, category: 'action' });
  }

  /**
   * Get the action menu items this extension provides
   */
  abstract getActions(): ActionMenuItem[];

  async activate(context: ExtensionContext): Promise<void> {
    this.log(`Action extension "${this.manifest.name}" activated`);
  }

  async deactivate(): Promise<void> {
    this.log(`Action extension "${this.manifest.name}" deactivated`);
  }
}
