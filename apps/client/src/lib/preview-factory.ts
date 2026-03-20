import { FileEntry } from '@/lib/tauri-api';

// Preview types
export type PreviewType =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'text'
  | 'code'
  | 'csv'
  | 'json'
  | 'markdown'
  | 'video'
  | 'audio'
  | 'archive'
  | 'folder'
  | 'unknown';

// Preview capability interface
export interface PreviewCapability {
  type: PreviewType;
  extensions: string[];
  mimeTypes?: string[];
  maxSize?: number; // Maximum file size in bytes for preview
  priority: number; // Higher priority previews are preferred
  canPreview: (file: FileEntry) => boolean;
  getPreviewComponent: () => Promise<React.ComponentType<PreviewProps>>;
}

// Preview component props
export interface PreviewProps {
  file: FileEntry;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

// Preview factory configuration
export interface PreviewFactoryConfig {
  enabledTypes: PreviewType[];
  maxFileSize: number;
  enableFallback: boolean;
  customPreviews?: Map<string, PreviewCapability>;
}

// Default configuration
const DEFAULT_CONFIG: PreviewFactoryConfig = {
  enabledTypes: [
    'image',
    'pdf',
    'document',
    'spreadsheet',
    'text',
    'code',
    'csv',
    'json',
    'markdown',
    'video',
    'audio',
  ],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  enableFallback: true,
  customPreviews: new Map(),
};

export class PreviewFactory {
  private config: PreviewFactoryConfig;
  private capabilities: Map<PreviewType, PreviewCapability>;

  constructor(config: Partial<PreviewFactoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.capabilities = new Map();
    this.initializeCapabilities();
  }

  private initializeCapabilities() {
    // Image previews
    this.capabilities.set('image', {
      type: 'image',
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff'],
      mimeTypes: ['image/'],
      maxSize: 20 * 1024 * 1024, // 20MB
      priority: 10,
      canPreview: (file) => this.canPreviewImage(file),
      getPreviewComponent: () =>
        import('@/components/previews/ImagePreview').then((m) => m.default),
    });

    // PDF previews
    this.capabilities.set('pdf', {
      type: 'pdf',
      extensions: ['pdf'],
      mimeTypes: ['application/pdf'],
      maxSize: 100 * 1024 * 1024, // 100MB
      priority: 10,
      canPreview: (file) => this.canPreviewPdf(file),
      getPreviewComponent: () => import('@/components/previews/PdfPreview').then((m) => m.default),
    });

    // Document previews (DOCX, DOC, etc.)
    this.capabilities.set('document', {
      type: 'document',
      extensions: ['docx', 'doc', 'odt', 'rtf'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxSize: 50 * 1024 * 1024, // 50MB
      priority: 9,
      canPreview: (file) => this.canPreviewDocument(file),
      getPreviewComponent: () =>
        import('@/components/previews/DocumentPreview').then((m) => m.default),
    });

    // Spreadsheet previews
    this.capabilities.set('spreadsheet', {
      type: 'spreadsheet',
      extensions: ['xlsx', 'xls', 'ods', 'csv'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      maxSize: 20 * 1024 * 1024, // 20MB
      priority: 9,
      canPreview: (file) => this.canPreviewSpreadsheet(file),
      getPreviewComponent: () =>
        import('@/components/previews/SpreadsheetPreview').then((m) => m.default),
    });

    // Text previews
    this.capabilities.set('text', {
      type: 'text',
      extensions: ['txt', 'log', 'ini', 'cfg', 'conf'],
      mimeTypes: ['text/plain'],
      maxSize: 5 * 1024 * 1024, // 5MB
      priority: 8,
      canPreview: (file) => this.canPreviewText(file),
      getPreviewComponent: () => import('@/components/previews/TextPreview').then((m) => m.default),
    });

    // Code previews
    this.capabilities.set('code', {
      type: 'code',
      extensions: [
        'js',
        'ts',
        'jsx',
        'tsx',
        'py',
        'java',
        'cpp',
        'c',
        'cs',
        'php',
        'rb',
        'go',
        'rs',
        'html',
        'css',
        'scss',
        'less',
        'vue',
        'svelte',
      ],
      mimeTypes: ['text/', 'application/javascript', 'application/typescript'],
      maxSize: 2 * 1024 * 1024, // 2MB
      priority: 9,
      canPreview: (file) => this.canPreviewCode(file),
      getPreviewComponent: () => import('@/components/previews/CodePreview').then((m) => m.default),
    });

    // CSV previews
    this.capabilities.set('csv', {
      type: 'csv',
      extensions: ['csv', 'tsv'],
      mimeTypes: ['text/csv'],
      maxSize: 10 * 1024 * 1024, // 10MB
      priority: 10,
      canPreview: (file) => this.canPreviewCsv(file),
      getPreviewComponent: () => import('@/components/previews/CsvPreview').then((m) => m.default),
    });

    // JSON previews
    this.capabilities.set('json', {
      type: 'json',
      extensions: ['json', 'jsonl', 'ndjson'],
      mimeTypes: ['application/json'],
      maxSize: 5 * 1024 * 1024, // 5MB
      priority: 9,
      canPreview: (file) => this.canPreviewJson(file),
      getPreviewComponent: () => import('@/components/previews/JsonPreview').then((m) => m.default),
    });

    // Markdown previews
    this.capabilities.set('markdown', {
      type: 'markdown',
      extensions: ['md', 'markdown', 'mdown', 'mkd'],
      mimeTypes: ['text/markdown'],
      maxSize: 5 * 1024 * 1024, // 5MB
      priority: 9,
      canPreview: (file) => this.canPreviewMarkdown(file),
      getPreviewComponent: () =>
        import('@/components/previews/MarkdownPreview').then((m) => m.default),
    });

    // Video previews
    this.capabilities.set('video', {
      type: 'video',
      extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ogv'],
      mimeTypes: ['video/'],
      maxSize: 2 * 1024 * 1024 * 1024, // 2GB
      priority: 10,
      canPreview: (file) => this.canPreviewVideo(file),
      getPreviewComponent: () =>
        import('@/components/previews/VideoPreview').then((m) => m.default),
    });

    // Audio previews
    this.capabilities.set('audio', {
      type: 'audio',
      extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'aiff'],
      mimeTypes: ['audio/'],
      maxSize: 500 * 1024 * 1024, // 500MB
      priority: 10,
      canPreview: (file) => this.canPreviewAudio(file),
      getPreviewComponent: () =>
        import('@/components/previews/AudioPreview').then((m) => m.default),
    });

    // Add custom previews from config
    if (this.config.customPreviews) {
      this.config.customPreviews.forEach((capability, _key) => {
        this.capabilities.set(capability.type, capability);
      });
    }
  }

  // Get file category/type
  public getFileType(file: FileEntry): PreviewType {
    if (file.is_dir) return 'folder';

    // Find the best matching capability
    let bestMatch: PreviewCapability | null = null;
    let highestPriority = -1;

    const capabilitiesArray = Array.from(this.capabilities.values());
    for (const capability of capabilitiesArray) {
      if (!this.config.enabledTypes.includes(capability.type)) continue;

      if (capability.canPreview(file)) {
        if (capability.priority > highestPriority) {
          highestPriority = capability.priority;
          bestMatch = capability;
        }
      }
    }

    return bestMatch?.type || 'unknown';
  }

  // Check if file can be previewed
  public canPreview(file: FileEntry): boolean {
    if (file.is_dir) return false;
    if (file.size > this.config.maxFileSize) return false;

    const fileType = this.getFileType(file);
    return fileType !== 'unknown';
  }

  // Get preview component for file
  public async getPreviewComponent(
    file: FileEntry,
  ): Promise<React.ComponentType<PreviewProps> | null> {
    const fileType = this.getFileType(file);
    const capability = this.capabilities.get(fileType);

    if (!capability) return null;
    if (!capability.canPreview(file)) return null;

    try {
      return await capability.getPreviewComponent();
    } catch (error) {
      console.error(`Failed to load preview component for ${fileType}:`, error);
      return null;
    }
  }

  // Register a new preview capability
  public registerPreview(capability: PreviewCapability): void {
    this.capabilities.set(capability.type, capability);
  }

  // Unregister a preview capability
  public unregisterPreview(type: PreviewType): void {
    this.capabilities.delete(type);
  }

  // Helper methods for determining file types
  private canPreviewImage(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('image')!;

    return capability.extensions.includes(ext) || (file.mime_type?.startsWith('image/') ?? false);
  }

  private canPreviewPdf(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ext === 'pdf' || file.mime_type === 'application/pdf';
  }

  private canPreviewDocument(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('document')!;

    return (
      capability.extensions.includes(ext) || (file.mime_type?.includes('wordprocessingml') ?? false)
    );
  }

  private canPreviewSpreadsheet(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('spreadsheet')!;

    return (
      capability.extensions.includes(ext) || (file.mime_type?.includes('spreadsheetml') ?? false)
    );
  }

  private canPreviewText(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('text')!;

    return (
      capability.extensions.includes(ext) || (file.mime_type?.startsWith('text/plain') ?? false)
    );
  }

  private canPreviewCode(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('code')!;

    return (
      capability.extensions.includes(ext) ||
      (file.mime_type?.startsWith('text/') ?? false) ||
      (file.mime_type?.includes('javascript') ?? false) ||
      (file.mime_type?.includes('typescript') ?? false)
    );
  }

  private canPreviewCsv(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ext === 'csv' || ext === 'tsv' || file.mime_type === 'text/csv';
  }

  private canPreviewJson(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('json')!;

    return capability.extensions.includes(ext) || (file.mime_type?.includes('json') ?? false);
  }

  private canPreviewMarkdown(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('markdown')!;

    return capability.extensions.includes(ext) || (file.mime_type?.includes('markdown') ?? false);
  }

  private canPreviewVideo(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('video')!;
    return capability.extensions.includes(ext) || (file.mime_type?.startsWith('video/') ?? false);
  }

  private canPreviewAudio(file: FileEntry): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const capability = this.capabilities.get('audio')!;
    return capability.extensions.includes(ext) || (file.mime_type?.startsWith('audio/') ?? false);
  }
}

// Export a default instance
export const defaultPreviewFactory = new PreviewFactory();
