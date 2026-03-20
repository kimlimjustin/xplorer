import React from 'react';
import { Extension } from './Extension';
import { ExtensionManifest, ExtensionContext, Theme } from '../types';

/**
 * Base class for theme extensions
 */
export abstract class ThemeExtension extends Extension {
  private theme?: Theme;

  constructor(manifest: Omit<ExtensionManifest, 'category'>) {
    super({ ...manifest, category: 'theme' });
  }

  /**
   * Get the theme configuration
   */
  abstract getTheme(): Theme;

  /**
   * Get theme variants (optional - for themes with multiple variants)
   */
  getThemeVariants?(): { [key: string]: Theme };

  /**
   * Get custom CSS (optional - for advanced theme customization)
   */
  getCustomCSS?(): string;

  /**
   * Get theme assets (optional - for themes with custom assets)
   */
  getThemeAssets?(): { [key: string]: string };

  async activate(context: ExtensionContext): Promise<void> {
    this.theme = this.getTheme();

    // Register the theme with Xplorer
    await this.registerTheme();

    // Register theme variants if available
    if (this.getThemeVariants) {
      await this.registerThemeVariants();
    }

    // Apply custom CSS if available
    if (this.getCustomCSS) {
      this.applyCustomCSS();
    }

    this.log(`Theme "${this.theme.name}" activated`);
  }

  async deactivate(): Promise<void> {
    if (this.theme) {
      await this.unregisterTheme();
      this.removeCustomCSS();
      this.log(`Theme "${this.theme.name}" deactivated`);
    }
  }

  private async registerTheme(): Promise<void> {
    if (!this.theme) return;

    try {
      // Register theme with Xplorer's theme manager
      await this.executeCommand('xplorer.themes.register', {
        id: this.manifest.id,
        theme: this.theme,
        extensionId: this.manifest.id,
      });
    } catch (error) {
      this.logError(`Failed to register theme: ${error}`);
    }
  }

  private async unregisterTheme(): Promise<void> {
    try {
      await this.executeCommand('xplorer.themes.unregister', this.manifest.id);
    } catch (error) {
      this.logError(`Failed to unregister theme: ${error}`);
    }
  }

  private async registerThemeVariants(): Promise<void> {
    if (!this.getThemeVariants) return;

    const variants = this.getThemeVariants();
    for (const [variantId, variantTheme] of Object.entries(variants)) {
      try {
        await this.executeCommand('xplorer.themes.register', {
          id: `${this.manifest.id}-${variantId}`,
          theme: variantTheme,
          extensionId: this.manifest.id,
          isVariant: true,
          parentTheme: this.manifest.id,
        });
      } catch (error) {
        this.logError(`Failed to register theme variant "${variantId}": ${error}`);
      }
    }
  }

  private applyCustomCSS(): void {
    if (!this.getCustomCSS) return;

    const css = this.getCustomCSS();
    const styleId = `${this.manifest.id}-custom-styles`;

    // Remove existing styles
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Apply new styles
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }

  private removeCustomCSS(): void {
    const styleId = `${this.manifest.id}-custom-styles`;
    const styleElement = document.getElementById(styleId);
    if (styleElement) {
      styleElement.remove();
    }
  }

  /**
   * Check if theme is currently active
   */
  protected async isThemeActive(): Promise<boolean> {
    try {
      const activeThemeId = await this.getConfig<string>('xplorer.theme.active');
      return activeThemeId === this.manifest.id;
    } catch {
      return false;
    }
  }

  /**
   * Activate this theme
   */
  protected async activateTheme(): Promise<void> {
    try {
      await this.executeCommand('xplorer.themes.activate', this.manifest.id);
      this.showMessage(`Theme "${this.theme?.name}" activated`);
    } catch (error) {
      this.logError(`Failed to activate theme: ${error}`);
      this.showMessage(`Failed to activate theme`, 'error');
    }
  }

  /**
   * Helper to create theme color with opacity
   */
  protected withOpacity(color: string, opacity: number): string {
    // Simple hex color with opacity conversion
    if (color.startsWith('#') && color.length === 7) {
      const alpha = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0');
      return `${color}${alpha}`;
    }
    // For RGB/HSL colors, you might want to handle them differently
    return `${color}${opacity.toString(16).slice(2, 4)}`;
  }

  /**
   * Helper to darken a color
   */
  protected darken(color: string, amount: number): string {
    // Simple implementation - you might want to use a proper color library
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const num = parseInt(hex, 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
      const b = Math.max(0, (num & 0x0000ff) - amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return color;
  }

  /**
   * Helper to lighten a color
   */
  protected lighten(color: string, amount: number): string {
    // Simple implementation - you might want to use a proper color library
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const num = parseInt(hex, 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
      const b = Math.min(255, (num & 0x0000ff) + amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return color;
  }
}
