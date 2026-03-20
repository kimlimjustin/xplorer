import { diffArrays } from 'diff';
import { TauriAPI } from './tauri-api';

export interface FileComparisonResult {
  file1: FileComparisonFile;
  file2: FileComparisonFile;
  differences: FileDifference[];
  identical: boolean;
  similarity: number; // 0-1 score
  comparisonType: ComparisonType;
  metadata: ComparisonMetadata;
  sideBySide?: SideBySideDiff;
}

export interface FileComparisonFile {
  path: string;
  name: string;
  size: number;
  modified: number;
  hash?: string;
  content?: string;
  lines?: string[];
  error?: string;
}

export interface FileDifference {
  diffType: DifferenceType;
  line1?: number;
  line2?: number;
  content1?: string;
  content2?: string;
  context?: string[];
  severity: DifferenceSeverity;
}

export interface ComparisonMetadata {
  processingTime: number;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  totalLines1: number;
  totalLines2: number;
  bytesDifferent: number;
  algorithm: string;
}

export type ComparisonType =
  | 'text' // Line-by-line text comparison
  | 'binary' // Byte-by-byte binary comparison
  | 'image' // Visual image comparison
  | 'video' // Visual video comparison
  | 'metadata' // File properties only
  | 'hash' // Hash-based comparison
  | 'structure'; // For archives/directories

export type DifferenceType =
  | 'added' // Line/content added in file2
  | 'removed' // Line/content removed from file1
  | 'modified' // Line/content changed
  | 'moved' // Line/content moved to different position
  | 'metadata'; // File properties differ

export type DifferenceSeverity = 'low' | 'medium' | 'high';

export interface ComparisonOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignoreLineEndings?: boolean;
  contextLines?: number;
  algorithm?: 'myers' | 'patience' | 'histogram' | 'minimal';
  maxFileSize?: number;
  binaryThreshold?: number;
}

/** A single row in the side-by-side diff view */
export interface SideBySideLine {
  type: 'unchanged' | 'added' | 'removed';
  lineLeft?: number; // line number in file1 (undefined = padding)
  lineRight?: number; // line number in file2 (undefined = padding)
  contentLeft: string; // text for left column (empty string for padding)
  contentRight: string; // text for right column (empty string for padding)
}

export interface SideBySideDiff {
  lines: SideBySideLine[];
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Compute a side-by-side diff suitable for rendering.
 * Uses Myers diff via diffArrays to align insertions/deletions.
 */
export const computeSideBySideDiff = (lines1: string[], lines2: string[]) : SideBySideDiff => {
  const changes = diffArrays(lines1, lines2);
  const result: SideBySideLine[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const change of changes) {
    if (!change.added && !change.removed) {
      // Unchanged lines
      for (const line of change.value) {
        result.push({
          type: 'unchanged',
          lineLeft: leftLineNum++,
          lineRight: rightLineNum++,
          contentLeft: line,
          contentRight: line,
        });
      }
    } else if (change.removed) {
      // Removed lines — show on left, padding on right
      for (const line of change.value) {
        result.push({
          type: 'removed',
          lineLeft: leftLineNum++,
          contentLeft: line,
          contentRight: '',
        });
        linesRemoved++;
      }
    } else if (change.added) {
      // Added lines — padding on left, show on right
      for (const line of change.value) {
        result.push({
          type: 'added',
          lineRight: rightLineNum++,
          contentLeft: '',
          contentRight: line,
        });
        linesAdded++;
      }
    }
  }

  return { lines: result, linesAdded, linesRemoved };
}

export class FileComparison {
  private static readonly DEFAULT_OPTIONS: ComparisonOptions = {
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLineEndings: false,
    contextLines: 3,
    algorithm: 'myers',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    binaryThreshold: 0.3, // 30% binary characters
  };

  /**
   * Compare two files and return detailed differences
   */
  static async compareFiles(
    file1Path: string,
    file2Path: string,
    options: ComparisonOptions = {},
  ): Promise<FileComparisonResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    try {
      // Get file metadata
      const [props1, props2] = await Promise.all([
        TauriAPI.getFileProperties(file1Path),
        TauriAPI.getFileProperties(file2Path),
      ]);

      const file1: FileComparisonFile = {
        path: file1Path,
        name: props1.name,
        size: props1.size,
        modified: props1.modified,
      };

      const file2: FileComparisonFile = {
        path: file2Path,
        name: props2.name,
        size: props2.size,
        modified: props2.modified,
      };

      // Quick checks for identical files
      if (props1.size === props2.size && props1.modified === props2.modified) {
        // Files might be identical, do hash comparison
        const hashComparison = await this.compareByHash(file1, file2);
        if (hashComparison.identical) {
          // Still read lines for text files so the UI can display content
          const compType = await this.determineComparisonType(file1Path, file2Path, opts);
          if (compType === 'text') {
            try {
              const content = await TauriAPI.readTextFile(file1Path);
              const lines = content.split('\n');
              file1.lines = lines;
              file2.lines = lines;
              file1.content = content;
              file2.content = content;
            } catch {
              /* ignore — UI will just show empty */
            }
          }
          return {
            file1,
            file2,
            differences: [],
            identical: true,
            similarity: 1.0,
            comparisonType: compType === 'text' ? 'text' : 'hash',
            metadata: {
              processingTime: Date.now() - startTime,
              linesAdded: 0,
              linesRemoved: 0,
              linesModified: 0,
              totalLines1: file1.lines?.length ?? 0,
              totalLines2: file2.lines?.length ?? 0,
              bytesDifferent: 0,
              algorithm: 'hash',
            },
          };
        }
      }

      // Size difference check
      const maxSize = Math.max(props1.size, props2.size);
      if (maxSize > opts.maxFileSize!) {
        throw new Error(
          `File too large for comparison (${maxSize} bytes > ${opts.maxFileSize} bytes)`,
        );
      }

      // Determine comparison type
      const comparisonType = await this.determineComparisonType(file1Path, file2Path, opts);

      // Perform appropriate comparison
      switch (comparisonType) {
        case 'text':
          return await this.compareTextFiles(file1, file2, opts, startTime);
        case 'binary':
          return await this.compareBinaryFiles(file1, file2, opts, startTime);
        case 'image':
          return await this.compareMediaFiles(file1, file2, 'image', startTime);
        case 'video':
          return await this.compareMediaFiles(file1, file2, 'video', startTime);
        default:
          return await this.compareTextFiles(file1, file2, opts, startTime);
      }
    } catch (error) {
      throw new Error(
        `File comparison failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Compare files by hash for quick identical file detection
   */
  private static async compareByHash(
    file1: FileComparisonFile,
    file2: FileComparisonFile,
  ): Promise<{ identical: boolean; hash1: string; hash2: string }> {
    try {
      // Use Tauri backend to compute file hashes
      const [hash1, hash2] = await Promise.all([
        TauriAPI.computeFileHash(file1.path),
        TauriAPI.computeFileHash(file2.path),
      ]);

      file1.hash = hash1;
      file2.hash = hash2;

      return {
        identical: hash1 === hash2,
        hash1,
        hash2,
      };
    } catch (error) {
      console.warn('Hash comparison failed, falling back to content comparison:', error);
      return { identical: false, hash1: '', hash2: '' };
    }
  }

  /**
   * Determine the best comparison method based on file types and content
   */
  private static async determineComparisonType(
    file1Path: string,
    file2Path: string,
    _options: ComparisonOptions,
  ): Promise<ComparisonType> {
    const ext1 = file1Path.split('.').pop()?.toLowerCase() || '';
    const ext2 = file2Path.split('.').pop()?.toLowerCase() || '';

    // Image files
    const imageExts = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'bmp',
      'webp',
      'svg',
      'ico',
      'tiff',
      'tif',
      'avif',
    ];
    if (imageExts.includes(ext1) && imageExts.includes(ext2)) {
      return 'image';
    }

    // Video files
    const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ogg', 'ogv', 'm4v'];
    if (videoExts.includes(ext1) && videoExts.includes(ext2)) {
      return 'video';
    }

    // Binary files
    const binaryExts = ['exe', 'dll', 'so', 'dylib', 'bin', 'pdf', 'doc', 'docx'];
    if (binaryExts.includes(ext1) || binaryExts.includes(ext2)) {
      return 'binary';
    }

    // Try to read a small portion to detect binary content
    try {
      const sample1 = await this.readFileSample(file1Path, 512);
      const sample2 = await this.readFileSample(file2Path, 512);

      if (this.isBinary(sample1) || this.isBinary(sample2)) {
        return 'binary';
      }
    } catch (error) {
      console.warn('Could not sample files for binary detection:', error);
    }

    return 'text';
  }

  /**
   * Read a small sample from file to detect binary content
   */
  private static async readFileSample(filePath: string, bytes: number): Promise<Uint8Array> {
    try {
      // Read full file for now, can optimize later to read only first N bytes
      const content = await TauriAPI.readBinaryFile(filePath);
      return content.slice(0, bytes);
    } catch (error) {
      throw new Error(`Failed to read file sample: ${error}`, { cause: error });
    }
  }

  /**
   * Detect if content is binary based on null bytes and non-printable characters
   */
  private static isBinary(content: Uint8Array): boolean {
    let binaryCount = 0;
    const maxCheck = Math.min(content.length, 512);

    for (let i = 0; i < maxCheck; i++) {
      const byte = content[i];
      // Null bytes or non-printable characters (except common whitespace)
      if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
        binaryCount++;
      }
    }

    return binaryCount / maxCheck > 0.3; // 30% binary characters threshold
  }

  /**
   * Compare two text files line by line
   */
  private static async compareTextFiles(
    file1: FileComparisonFile,
    file2: FileComparisonFile,
    options: ComparisonOptions,
    startTime: number,
  ): Promise<FileComparisonResult> {
    try {
      // Read file contents
      const [content1, content2] = await Promise.all([
        TauriAPI.readTextFile(file1.path),
        TauriAPI.readTextFile(file2.path),
      ]);

      file1.content = content1;
      file2.content = content2;

      // Split into lines and normalize if needed
      let lines1 = content1.split('\n');
      let lines2 = content2.split('\n');

      if (options.ignoreLineEndings) {
        lines1 = lines1.map((line) => line.replace(/\r$/g, ''));
        lines2 = lines2.map((line) => line.replace(/\r$/g, ''));
      }

      if (options.ignoreWhitespace) {
        lines1 = lines1.map((line) => line.trim());
        lines2 = lines2.map((line) => line.trim());
      }

      if (options.ignoreCase) {
        lines1 = lines1.map((line) => line.toLowerCase());
        lines2 = lines2.map((line) => line.toLowerCase());
      }

      file1.lines = lines1;
      file2.lines = lines2;

      // Compute side-by-side diff using Myers algorithm
      const sideBySide = computeSideBySideDiff(lines1, lines2);

      // Build legacy differences array from the Myers result
      const differences: FileDifference[] = [];
      for (const row of sideBySide.lines) {
        if (row.type === 'removed') {
          differences.push({
            diffType: 'removed',
            line1: row.lineLeft,
            content1: row.contentLeft,
            severity: 'medium',
          });
        } else if (row.type === 'added') {
          differences.push({
            diffType: 'added',
            line2: row.lineRight,
            content2: row.contentRight,
            severity: 'medium',
          });
        }
      }

      // Calculate similarity
      const totalLines = Math.max(lines1.length, lines2.length);
      const changedLines = sideBySide.linesAdded + sideBySide.linesRemoved;
      const similarity = totalLines === 0 ? 1.0 : Math.max(0, 1 - changedLines / (totalLines * 2));

      return {
        file1,
        file2,
        differences,
        identical: differences.length === 0,
        similarity,
        comparisonType: 'text',
        sideBySide,
        metadata: {
          processingTime: Date.now() - startTime,
          linesAdded: sideBySide.linesAdded,
          linesRemoved: sideBySide.linesRemoved,
          linesModified: 0,
          totalLines1: lines1.length,
          totalLines2: lines2.length,
          bytesDifferent: Math.abs(content1.length - content2.length),
          algorithm: 'myers',
        },
      };
    } catch (error) {
      file1.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Compare two binary files byte by byte
   */
  private static async compareBinaryFiles(
    file1: FileComparisonFile,
    file2: FileComparisonFile,
    options: ComparisonOptions,
    startTime: number,
  ): Promise<FileComparisonResult> {
    try {
      const [content1, content2] = await Promise.all([
        TauriAPI.readBinaryFile(file1.path),
        TauriAPI.readBinaryFile(file2.path),
      ]);

      const differences: FileDifference[] = [];
      let bytesDifferent = 0;

      // Quick size check
      if (content1.length !== content2.length) {
        differences.push({
          diffType: 'metadata',
          content1: `Size: ${content1.length} bytes`,
          content2: `Size: ${content2.length} bytes`,
          severity: 'high',
        });
        bytesDifferent = Math.abs(content1.length - content2.length);
      }

      // Byte-by-byte comparison for first differences
      const maxLength = Math.min(content1.length, content2.length);
      let firstDifferenceFound = false;

      for (let i = 0; i < maxLength && differences.length < 100; i++) {
        if (content1[i] !== content2[i]) {
          if (!firstDifferenceFound) {
            differences.push({
              diffType: 'modified',
              content1: `Byte ${i}: 0x${content1[i].toString(16).padStart(2, '0')}`,
              content2: `Byte ${i}: 0x${content2[i].toString(16).padStart(2, '0')}`,
              severity: 'medium',
            });
            firstDifferenceFound = true;
          }
          bytesDifferent++;
        }
      }

      const identical = content1.length === content2.length && bytesDifferent === 0;
      const similarity = maxLength === 0 ? 1.0 : (maxLength - bytesDifferent) / maxLength;

      return {
        file1,
        file2,
        differences,
        identical,
        similarity,
        comparisonType: 'binary',
        metadata: {
          processingTime: Date.now() - startTime,
          linesAdded: 0,
          linesRemoved: 0,
          linesModified: differences.filter((d) => d.diffType === 'modified').length,
          totalLines1: 0,
          totalLines2: 0,
          bytesDifferent,
          algorithm: 'byte-comparison',
        },
      };
    } catch (error) {
      file1.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Compare two media files (images or videos) by hash and metadata.
   * The UI renders them side-by-side visually.
   */
  private static async compareMediaFiles(
    file1: FileComparisonFile,
    file2: FileComparisonFile,
    type: 'image' | 'video',
    startTime: number,
  ): Promise<FileComparisonResult> {
    const differences: FileDifference[] = [];

    // Size difference
    if (file1.size !== file2.size) {
      differences.push({
        diffType: 'metadata',
        content1: `Size: ${file1.size} bytes`,
        content2: `Size: ${file2.size} bytes`,
        severity: 'medium',
      });
    }

    // Modification date difference
    if (file1.modified !== file2.modified) {
      differences.push({
        diffType: 'metadata',
        content1: `Modified: ${new Date(file1.modified * 1000).toLocaleString()}`,
        content2: `Modified: ${new Date(file2.modified * 1000).toLocaleString()}`,
        severity: 'low',
      });
    }

    // Hash comparison
    let identical = false;
    try {
      const { identical: hashIdentical } = await this.compareByHash(file1, file2);
      identical = hashIdentical;
    } catch {
      // Hash failed — treat as different
    }

    return {
      file1,
      file2,
      differences,
      identical,
      similarity: identical ? 1.0 : differences.length === 0 ? 0.99 : 0.5,
      comparisonType: type,
      metadata: {
        processingTime: Date.now() - startTime,
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0,
        totalLines1: 0,
        totalLines2: 0,
        bytesDifferent: Math.abs(file1.size - file2.size),
        algorithm: 'hash',
      },
    };
  }

  /**
   * Compare multiple files and find duplicates
   */
  static async findDuplicates(filePaths: string[]): Promise<Map<string, string[]>> {
    const hashGroups = new Map<string, string[]>();

    for (const filePath of filePaths) {
      try {
        const hash = await TauriAPI.computeFileHash(filePath);
        const existing = hashGroups.get(hash) || [];
        existing.push(filePath);
        hashGroups.set(hash, existing);
      } catch (error) {
        console.warn(`Failed to hash file ${filePath}:`, error);
      }
    }

    // Filter to only groups with duplicates
    const duplicates = new Map<string, string[]>();
    for (const [hash, paths] of hashGroups.entries()) {
      if (paths.length > 1) {
        duplicates.set(hash, paths);
      }
    }

    return duplicates;
  }
}
