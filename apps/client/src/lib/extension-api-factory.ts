/**
 * Factory that builds the sandboxed API surface exposed to extensions.
 * Extracted from ExtensionHost.createExtensionApi to reduce file size.
 */
import { TauriAPI } from './tauri-api';
import { transport } from './transport';
import type { ImageOperations } from './tauri-api-types';
import {
  isPathAllowed,
  type ExtensionManifest,
  type EventCallback,
  type EventBus,
  type CommandHandler,
} from './extension-host-types';
import { BLOCKED_TAURI_COMMANDS } from './extension-sandbox';
import { AIService } from './ai-service';
import { AgentService } from './agent-service';

/** Dependencies injected by the ExtensionHost instance */
export interface ExtensionApiDeps {
  hasPermission: (manifest: ExtensionManifest, permission: string) => boolean;
  registerCommand: (
    command: string,
    handler: CommandHandler,
    metadata?: { title?: string; shortcut?: string; category?: string },
  ) => { dispose: () => void };
  executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
  eventBus: EventBus;
}

/**
 * Create the extension API object for a given manifest.
 * The returned object is the `api` parameter passed to extensions via _setContext / factory.
 */
export const createExtensionApi = (manifest: ExtensionManifest, deps: ExtensionApiDeps) => {
  const { hasPermission, registerCommand, executeCommand, eventBus } = deps;

  return {
    files: {
      readText: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readTextFile(path);
      },
      read: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readBinaryFile(path);
      },
      write: async (path: string, content: string | ArrayBuffer) => {
        if (!hasPermission(manifest, 'file:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
        return TauriAPI.agentWriteFileWithPermission(path, text, false);
      },
      exists: async (path: string) => {
        if (!hasPermission(manifest, 'file:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.fileExists(path);
      },
      list: async (path: string) => {
        if (!hasPermission(manifest, 'directory:list')) {
          throw new Error(`Extension "${manifest.id}" missing permission: directory:list`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.readDirectory(path);
      },
    },
    ui: {
      showMessage: (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
        if (type === 'error') {
          console.error(`[${manifest.name}] ${message}`);
        } else {
          console.warn(`[${manifest.name}] ${message}`);
        }
      },
      showInputBox: async (options?: {
        prompt?: string;
        placeholder?: string;
        value?: string;
      }): Promise<string | null> => {
        const result = window.prompt(options?.prompt ?? '', options?.value ?? '');
        return result;
      },
    },
    navigation: {
      getCurrentPath: () => window.__xplorer_state__?.currentPath || '',
      navigateTo: (path: string) => {
        window.__xplorer_state__?.navigateTo?.(path);
      },
      openInEditor: (path: string) => {
        window.dispatchEvent(new CustomEvent('xplorer-open-in-editor', { detail: { path } }));
      },
      openTab: (options: {
        type: string;
        name: string;
        path: string;
        data?: Record<string, unknown>;
      }) => {
        window.dispatchEvent(new CustomEvent('xplorer-open-tab', { detail: options }));
      },
    },
    settings: {
      get: async <T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> => {
        const value = await TauriAPI.getExtensionStorage(manifest.id, key);
        return (value as T) ?? defaultValue;
      },
      set: async (key: string, value: unknown) =>
        TauriAPI.setExtensionStorage(manifest.id, key, value),
      delete: async (key: string) => TauriAPI.deleteExtensionStorage(manifest.id, key),
    },
    storage: {
      get: async <T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> => {
        const value = await TauriAPI.getExtensionStorage(manifest.id, key);
        return (value as T) ?? defaultValue;
      },
      set: async (key: string, value: unknown) =>
        TauriAPI.setExtensionStorage(manifest.id, key, value),
      delete: async (key: string) => TauriAPI.deleteExtensionStorage(manifest.id, key),
    },
    git: {
      findRepository: async (path: string) => TauriAPI.findGitRepository(path),
      getRepositoryInfo: async (repoPath: string) => TauriAPI.getRepositoryInfo(repoPath),
      getAllCommits: async (repoPath: string, limit?: number, branch?: string) =>
        TauriAPI.getAllCommits(repoPath, limit, branch),
      getBranches: async (repoPath: string) => TauriAPI.getBranches(repoPath),
      getFileHistory: async (repoPath: string, filePath: string, limit?: number) =>
        TauriAPI.getFileHistory(repoPath, filePath, limit),
      getFileBlame: async (repoPath: string, filePath: string) =>
        TauriAPI.getFileBlame(repoPath, filePath),
      getFileDiff: async (repoPath: string, filePath: string, commitHash?: string) =>
        TauriAPI.getFileDiff(repoPath, filePath, commitHash),
      getCommitDiff: async (repoPath: string, commitHash: string) =>
        TauriAPI.getCommitDiff(repoPath, commitHash),
      getFileStatus: async (repoPath: string) => TauriAPI.getFileStatus(repoPath),
      switchBranch: async (repoPath: string, branchName: string) =>
        TauriAPI.switchBranch(repoPath, branchName),
      createBranch: async (repoPath: string, branchName: string, fromCommit?: string) =>
        TauriAPI.createBranch(repoPath, branchName, fromCommit),
      deleteBranch: async (repoPath: string, branchName: string, force?: boolean) =>
        TauriAPI.deleteBranch(repoPath, branchName, force ?? false),
      stageFile: async (repoPath: string, filePath: string) =>
        TauriAPI.stageFile(repoPath, filePath),
      unstageFile: async (repoPath: string, filePath: string) =>
        TauriAPI.unstageFile(repoPath, filePath),
      commitChanges: async (repoPath: string, message: string, amend?: boolean) =>
        TauriAPI.commitChanges(repoPath, message, amend ?? false),
      pull: async (repoPath: string) => transport('git_pull', { directory: repoPath }),
      push: async (repoPath: string, force?: boolean) =>
        transport('git_push', { directory: repoPath, force: force ?? false }),
      fetch: async (repoPath: string) => transport('git_fetch', { directory: repoPath }),
    },
    commands: {
      register: (
        command: string,
        callback: (...args: unknown[]) => unknown,
        metadata?: { title?: string; shortcut?: string; category?: string },
      ) => {
        const namespacedId = command.startsWith(`${manifest.id}.`)
          ? command
          : `${manifest.id}.${command}`;
        return registerCommand(namespacedId, callback, metadata);
      },
      execute: (command: string, ...args: unknown[]) => {
        // Allow executing own namespaced commands, state/workspace commands, or explicitly namespaced commands
        const allowedPrefixes = [
          `${manifest.id}.`,
          `state:${manifest.id}:`,
          `workspace:${manifest.id}:`,
        ];
        const isOwn = allowedPrefixes.some((p) => command.startsWith(p));
        // Also allow if the command already has a namespace (contains a dot)
        if (!isOwn && !command.includes('.') && !command.includes(':')) {
          // No namespace provided — rewrite to caller's own namespace
          command = `${manifest.id}.${command}`;
        } else if (!isOwn) {
          // Command is explicitly targeting another extension's namespace;
          // require the extensions:invoke permission for cross-extension calls.
          if (!hasPermission(manifest, 'extensions:invoke')) {
            throw new Error(
              `Extension "${manifest.id}" missing permission: extensions:invoke (required to execute cross-extension command "${command}")`,
            );
          }
        }
        return executeCommand(command, ...args);
      },
    },
    events: {
      on: (event: string, callback: EventCallback): { dispose: () => void } => {
        const ownPrefix = `${manifest.id}:`;
        const isOwn = event === manifest.id || event.startsWith(ownPrefix);
        const isSystem = event.startsWith('system:') || event.startsWith('xplorer:');
        if (!isOwn && !isSystem) {
          console.warn(
            `[Security] Extension "${manifest.id}" tried to listen to event "${event}" outside its namespace`,
          );
          return { dispose: () => {} }; // noop unsubscribe
        }
        return eventBus.on(event, callback);
      },
      emit: (event: string, data?: unknown) => {
        // Only emit own events -- auto-prefix if not already prefixed
        const ownPrefix = `${manifest.id}:`;
        if (event !== manifest.id && !event.startsWith(ownPrefix)) {
          event = `${manifest.id}:${event}`;
        }
        eventBus.emit(event, data);
      },
    },
    nativeInvoke: async (command: string, args?: Record<string, unknown>) => {
      if (BLOCKED_TAURI_COMMANDS.has(command)) {
        throw new Error(
          `Extension "${manifest.id}" blocked from invoking restricted command: ${command}`,
        );
      }
      if (!hasPermission(manifest, 'native:invoke')) {
        throw new Error(`Extension "${manifest.id}" missing permission: native:invoke`);
      }
      return TauriAPI.nativePluginInvoke(manifest.id, manifest.id, command, args || {});
    },
    shortcuts: {
      register: async (
        shortcutId: string,
        options: { key: string; title?: string; when?: string },
      ) => {
        const parts = options.key.toLowerCase().split('+');
        const key = parts[parts.length - 1];
        return TauriAPI.registerExtensionShortcut(
          manifest.id,
          shortcutId,
          options.title || shortcutId,
          options.title || null,
          {
            key,
            ctrl: parts.includes('ctrl'),
            alt: parts.includes('alt'),
            shift: parts.includes('shift'),
            meta: parts.includes('meta'),
          },
          shortcutId,
          options.when ? [options.when] : ['file-explorer'],
        );
      },
      unregisterAll: async () => {
        return TauriAPI.unregisterExtensionShortcuts(manifest.id);
      },
    },
    images: {
      resize: async (
        path: string,
        width: number,
        height: number,
        maintainAspect: boolean,
        outputPath: string,
      ) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.resizeImage(path, width, height, maintainAspect, outputPath);
      },
      convert: async (path: string, outputFormat: string, quality: number, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.convertImage(path, outputFormat, quality, outputPath);
      },
      getInfo: async (path: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getImageInfo(path);
      },
      batchProcess: async (
        paths: string[],
        operations: Record<string, unknown>,
        outputDir: string,
      ) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.batchProcessImages(
          paths,
          operations as unknown as ImageOperations,
          outputDir,
        );
      },
      rotate: async (path: string, degrees: number, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.rotateImage(path, degrees, outputPath);
      },
      flip: async (path: string, direction: string, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.flipImage(path, direction, outputPath);
      },
      crop: async (
        path: string,
        x: number,
        y: number,
        width: number,
        height: number,
        outputPath: string,
      ) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.cropImage(path, x, y, width, height, outputPath);
      },
      adjustBrightness: async (path: string, value: number, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.adjustBrightness(path, value, outputPath);
      },
      adjustContrast: async (path: string, value: number, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.adjustContrast(path, value, outputPath);
      },
      grayscale: async (path: string, outputPath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.grayscaleImage(path, outputPath);
      },
    },
    database: {
      listTables: async (path: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.listSqliteTables(path);
      },
      getTableColumns: async (path: string, table: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.getSqliteTableColumns(path, table);
      },
      queryTable: async (path: string, table: string, limit: number, offset: number) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.querySqliteTable(path, table, limit, offset);
      },
      executeQuery: async (path: string, query: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!isPathAllowed(path, '')) {
          throw new Error(`Extension "${manifest.id}" blocked from accessing path: ${path}`);
        }
        return TauriAPI.executeSqliteQuery(path, query);
      },
    },
    backup: {
      create: async (sourceDir: string, backupDir: string, name: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.createBackup(sourceDir, backupDir, name);
      },
      list: async (backupDir: string, name: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.listBackups(backupDir, name);
      },
      restore: async (backupId: string, backupDir: string, name: string, restoreTo: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.restoreBackup(backupId, backupDir, name, restoreTo);
      },
      delete: async (backupId: string, backupDir: string, name: string) => {
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.deleteBackup(backupId, backupDir, name);
      },
      onProgress: (
        callback: (progress: {
          phase: string;
          current: number;
          total: number;
          current_file: string;
          percentage: number;
        }) => void,
      ): { dispose: () => void } => {
        let unlisten: (() => void) | null = null;
        TauriAPI.listenToEvent('backup-progress', callback).then((fn) => {
          unlisten = fn;
        });
        return {
          dispose: () => {
            if (unlisten) unlisten();
          },
        };
      },
    },
    docker: {
      isAvailable: async () => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerIsAvailable();
      },
      listContainers: async (all: boolean) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerListContainers(all);
      },
      listImages: async () => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerListImages();
      },
      startContainer: async (id: string) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerStartContainer(id);
      },
      stopContainer: async (id: string) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerStopContainer(id);
      },
      removeContainer: async (id: string, force: boolean) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerRemoveContainer(id, force);
      },
      removeImage: async (id: string, force: boolean) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerRemoveImage(id, force);
      },
      containerLogs: async (id: string, lines: number) => {
        if (!hasPermission(manifest, 'system:exec')) {
          throw new Error(`Extension "${manifest.id}" missing permission: system:exec`);
        }
        return TauriAPI.dockerContainerLogs(id, lines);
      },
    },
    versions: {
      create: async (filePath: string) => {
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.createVersion(filePath);
      },
      list: async (filePath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.listVersions(filePath);
      },
      restore: async (filePath: string, versionNumber: number) => {
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.restoreVersion(filePath, versionNumber);
      },
      delete: async (filePath: string, versionNumber: number) => {
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.deleteVersion(filePath, versionNumber);
      },
      deleteAll: async (filePath: string) => {
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.deleteAllVersions(filePath);
      },
      getCount: async (filePath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.getVersionCount(filePath);
      },
      readContent: async (filePath: string, versionNumber: number) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.readVersionContent(filePath, versionNumber);
      },
      isEnabled: async (filePath: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.isVersioningEnabled(filePath);
      },
    },
    backend: {
      call: async (method: string, args?: Record<string, unknown>) => {
        return TauriAPI.extensionBackendCall(manifest.id, method, args ?? {});
      },
      isLoaded: async () => {
        const status = await TauriAPI.extensionBackendStatus(manifest.id);
        return status.loaded;
      },
    },
    ai: {
      chat: async (messages: Array<{ role: string; content: string }>): Promise<string> => {
        if (!hasPermission(manifest, 'ai:chat')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:chat`);
        }
        const settings = await AgentService.getSettings();
        const chatMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));
        return AIService.chatWithAI(settings.model, chatMessages);
      },
      getProvider: async (): Promise<{ model: string; provider: string }> => {
        if (!hasPermission(manifest, 'ai:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:read`);
        }
        const settings = await AgentService.getSettings();
        const m = settings.model;
        const provider = m.startsWith('claude')
          ? 'anthropic'
          : m.startsWith('gpt') ||
              m.startsWith('o3') ||
              m.startsWith('o4') ||
              m.startsWith('chatgpt')
            ? 'openai'
            : m.startsWith('gemini')
              ? 'google'
              : m.startsWith('deepseek')
                ? 'deepseek'
                : m.startsWith('mistral') || m.startsWith('codestral')
                  ? 'mistral'
                  : m.startsWith('llama')
                    ? 'meta'
                    : 'ollama';
        return { model: settings.model, provider };
      },
      startAgent: async (
        messages: Array<{ role: string; content: string }>,
        currentPath: string,
        onEvent: (event: unknown) => void,
      ): Promise<string> => {
        if (!hasPermission(manifest, 'ai:chat')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:chat`);
        }
        return AgentService.startAgentChat(messages, currentPath, onEvent);
      },
      respondToApproval: async (toolCallId: string, response: string): Promise<void> => {
        if (!hasPermission(manifest, 'ai:chat')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:chat`);
        }
        return AgentService.respondToApproval(toolCallId, response);
      },
      cancelAgent: async (): Promise<void> => {
        if (!hasPermission(manifest, 'ai:chat')) {
          throw new Error(`Extension "${manifest.id}" missing permission: ai:chat`);
        }
        return AgentService.cancelSession();
      },
    },
    analytics: {
      analyzeStorage: async (path: string) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.analyzeStorage(path);
      },
    },
    search: {
      findDuplicates: async (
        rootPath: string,
        options?: {
          minFileSize?: number;
          maxFileSize?: number;
          includeHidden?: boolean;
          fileExtensions?: string[];
          excludePaths?: string[];
        },
      ) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.findDuplicates(
          rootPath,
          options?.minFileSize,
          options?.maxFileSize,
          options?.includeHidden,
          options?.fileExtensions,
          options?.excludePaths,
        );
      },
      semantic: async (query: string, limit?: number) => {
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.semanticSearch(query, limit);
      },
    },
    dialog: {
      pickFile: async (options?: {
        multiple?: boolean;
        directory?: boolean;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => {
        return TauriAPI.showOpenDialog({
          multiple: options?.multiple ?? false,
          directory: options?.directory ?? false,
          filters: options?.filters,
        });
      },
      pickSaveFile: async (defaultName?: string) => {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const result = await save({
            defaultPath: defaultName,
          });
          return result ?? null;
        } catch (error) {
          console.error(`[${manifest.name}] Error opening save dialog:`, error);
          return null;
        }
      },
      confirm: async (message: string, _title?: string): Promise<boolean> => {
        try {
          const { confirm } = await import('@tauri-apps/plugin-dialog');
          return await confirm(message);
        } catch {
          return window.confirm(message);
        }
      },
    },
    gdrive: {
      authenticate: async () => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveAuthenticate();
      },
      disconnect: async (accountId: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveDisconnect(accountId);
      },
      listAccounts: async () => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveListAccounts();
      },
      listFiles: async (accountId: string, folderId: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveListFiles(accountId, folderId);
      },
      downloadFile: async (accountId: string, fileId: string, localPath: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        if (!hasPermission(manifest, 'file:write') && !hasPermission(manifest, 'files:write')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:write`);
        }
        return TauriAPI.gdriveDownloadFile(accountId, fileId, localPath);
      },
      uploadFile: async (accountId: string, localPath: string, parentFolderId: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        if (!hasPermission(manifest, 'file:read') && !hasPermission(manifest, 'files:read')) {
          throw new Error(`Extension "${manifest.id}" missing permission: file:read`);
        }
        return TauriAPI.gdriveUploadFile(accountId, localPath, parentFolderId);
      },
      deleteFile: async (accountId: string, fileId: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveDeleteFile(accountId, fileId);
      },
      renameFile: async (accountId: string, fileId: string, newName: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveRenameFile(accountId, fileId, newName);
      },
      createFolder: async (accountId: string, name: string, parentFolderId: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.gdriveCreateFolder(accountId, name, parentFolderId);
      },
      getSettings: async () => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.getGdriveSettings();
      },
      updateSettings: async (clientId: string, clientSecret: string) => {
        if (!hasPermission(manifest, 'network:access')) {
          throw new Error(`Extension "${manifest.id}" missing permission: network:access`);
        }
        return TauriAPI.updateGdriveSettings(clientId, clientSecret);
      },
    },
  };
};

/** Return type of createExtensionApi for use in type annotations */
export type ExtensionApi = ReturnType<typeof createExtensionApi>;
