import { Extension } from '../core/Extension';

/**
 * Register an extension with the Xplorer host.
 * Call this from your extension's entry point after creating the extension instance.
 */
export const registerExtension = (extension: Extension): void => {
  const win = window as unknown as Record<string, unknown>;
  const register = win.__xplorer_register__ as ((ext: unknown) => void) | undefined;
  if (typeof window !== 'undefined' && register) {
    register(extension);
  } else {
    console.warn(
      `[${extension.manifest.name}] Could not register extension: Xplorer host not available. ` +
        `Make sure registerExtension() is called within the Xplorer runtime.`,
    );
  }
};
