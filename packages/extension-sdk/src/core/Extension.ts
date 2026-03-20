import { ExtensionManifest, ExtensionContext, ExtensionLifecycle, XplorerAPI } from '../types';

/**
 * Base class for all Xplorer extensions
 */
export abstract class Extension implements ExtensionLifecycle {
  public readonly manifest: ExtensionManifest;
  protected context?: ExtensionContext;
  protected api?: XplorerAPI;

  constructor(manifest: ExtensionManifest) {
    this.manifest = manifest;
  }

  /**
   * Called when the extension is activated
   */
  abstract activate(context: ExtensionContext): Promise<void> | void;

  /**
   * Called when the extension is deactivated
   */
  abstract deactivate(): Promise<void> | void;

  /**
   * Get the extension context
   */
  protected getContext(): ExtensionContext {
    if (!this.context) {
      throw new Error('Extension context not available. Make sure the extension is activated.');
    }
    return this.context;
  }

  /**
   * Get the Xplorer API
   */
  protected getAPI(): XplorerAPI {
    if (!this.api) {
      throw new Error('Xplorer API not available. Make sure the extension is activated.');
    }
    return this.api;
  }

  /**
   * Internal method to set context and API (called by Xplorer)
   */
  public _setContext(context: ExtensionContext, api: XplorerAPI): void {
    this.context = context;
    this.api = api;
  }

  /**
   * Get extension configuration value
   */
  protected getConfig<T>(key: string, defaultValue?: T): T {
    return this.getAPI().settings.get(`${this.manifest.id}.${key}`, defaultValue);
  }

  /**
   * Set extension configuration value
   */
  protected async setConfig<T>(key: string, value: T): Promise<void> {
    return this.getAPI().settings.set(`${this.manifest.id}.${key}`, value);
  }

  /**
   * Show a message to the user
   */
  protected showMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.getAPI().ui.showMessage(message, type);
  }

  /**
   * Log a message (for debugging)
   */
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.manifest.name}] ${message}`, ...args);
  }

  /**
   * Log an error
   */
  protected logError(error: Error | string, ...args: any[]): void {
    const errorMessage = error instanceof Error ? error.message : error;
    console.error(`[${this.manifest.name}] ${errorMessage}`, ...args);
  }

  /**
   * Register a command
   */
  protected registerCommand(
    command: string,
    callback: (...args: any[]) => any,
  ): { dispose(): void } {
    const fullCommand = `${this.manifest.id}.${command}`;
    const disposable = this.getAPI().commands.register(fullCommand, callback);
    this.getContext().subscriptions.push(disposable);
    return disposable;
  }

  /**
   * Execute a command
   */
  protected executeCommand(command: string, ...args: any[]): Promise<any> {
    return this.getAPI().commands.execute(command, ...args);
  }

  /**
   * Get absolute path for a file relative to the extension
   */
  protected getAbsolutePath(relativePath: string): string {
    return this.getContext().asAbsolutePath(relativePath);
  }

  /**
   * Store data in global state (persists across sessions)
   */
  protected setGlobalState<T>(key: string, value: T): void {
    this.getContext().globalState.set(key, value);
  }

  /**
   * Get data from global state
   */
  protected getGlobalState<T>(key: string): T | undefined {
    return this.getContext().globalState.get<T>(key);
  }

  /**
   * Store data in workspace state (persists for current workspace)
   */
  protected setWorkspaceState<T>(key: string, value: T): void {
    this.getContext().workspaceState.set(key, value);
  }

  /**
   * Get data from workspace state
   */
  protected getWorkspaceState<T>(key: string): T | undefined {
    return this.getContext().workspaceState.get<T>(key);
  }
}
