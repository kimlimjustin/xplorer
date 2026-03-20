import React, { useState, useEffect } from 'react';
import { convertAssetUrl } from '@/lib/transport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileIcon, X, Clock, Hash, Scale, AlertTriangle } from 'lucide-react';
import {
  FileComparison,
  type FileComparisonResult,
  type ComparisonOptions,
} from '@/lib/file-comparison';

interface FileComparisonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file1Path: string;
  file2Path: string;
  onError?: (error: string) => void;
}

const FileComparisonDialog = ({
  isOpen,
  onClose,
  file1Path,
  file2Path,
  onError,
}: FileComparisonDialogProps) => {
  const [comparisonResult, setComparisonResult] = useState<FileComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('summary');

  useEffect(() => {
    if (isOpen && file1Path && file2Path) {
      performComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, file1Path, file2Path]);

  const performComparison = async () => {
    setLoading(true);
    try {
      const options: ComparisonOptions = {
        ignoreWhitespace: false,
        ignoreCase: false,
        ignoreLineEndings: false,
        contextLines: 3,
        algorithm: 'myers',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        binaryThreshold: 0.3,
      };

      const result = await FileComparison.compareFiles(file1Path, file2Path, options);
      setComparisonResult(result);
      setSelectedTab(
        result.comparisonType === 'image' || result.comparisonType === 'video'
          ? 'side-by-side'
          : 'summary',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Comparison failed';
      onError?.(errorMessage);
      console.error('File comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderSummaryTab = () => {
    if (!comparisonResult) return null;

    const { file1, file2, identical, similarity, comparisonType, metadata } = comparisonResult;

    return (
      <div className="space-y-6">
        {/* Status Banner */}
        <div
          className={`p-4 rounded-lg border ${identical ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}
        >
          <div className="flex items-center gap-2">
            {identical ? (
              <Badge variant="success" className="gap-2">
                <Scale className="w-4 h-4" />
                Files are identical
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Files differ
              </Badge>
            )}
            <Badge variant="outline" className="ml-2">
              {(similarity * 100).toFixed(1)}% similar
            </Badge>
            <Badge variant="outline">{comparisonType} comparison</Badge>
          </div>
        </div>

        {/* File Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-700">File 1</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-blue-500" />
                <span className="font-mono truncate" title={file1.path}>
                  {file1.name}
                </span>
              </div>
              <div className="text-gray-600">Size: {formatFileSize(file1.size)}</div>
              <div className="text-gray-600">Modified: {formatDate(file1.modified)}</div>
              {file1.hash && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Hash className="w-3 h-3" />
                  <span className="font-mono text-xs truncate">{file1.hash}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-700">File 2</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-green-500" />
                <span className="font-mono truncate" title={file2.path}>
                  {file2.name}
                </span>
              </div>
              <div className="text-gray-600">Size: {formatFileSize(file2.size)}</div>
              <div className="text-gray-600">Modified: {formatDate(file2.modified)}</div>
              {file2.hash && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Hash className="w-3 h-3" />
                  <span className="font-mono text-xs truncate">{file2.hash}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-green-600">{metadata.linesAdded}</div>
            <div className="text-xs text-gray-600">Lines Added</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-red-600">{metadata.linesRemoved}</div>
            <div className="text-xs text-gray-600">Lines Removed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-orange-600">{metadata.linesModified}</div>
            <div className="text-xs text-gray-600">Lines Modified</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-blue-600">
              {formatFileSize(metadata.bytesDifferent)}
            </div>
            <div className="text-xs text-gray-600">Bytes Different</div>
          </div>
        </div>

        {/* Processing Info */}
        <div className="text-xs text-gray-500 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Processed in {metadata.processingTime}ms
          </div>
          <div>Algorithm: {metadata.algorithm}</div>
          <div>
            Total lines: {metadata.totalLines1} / {metadata.totalLines2}
          </div>
        </div>
      </div>
    );
  };

  const renderDifferencesTab = () => {
    if (!comparisonResult || comparisonResult.differences.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Scale className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <div className="text-lg font-medium">No differences found</div>
          <div className="text-sm">The files are identical</div>
        </div>
      );
    }

    return (
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {comparisonResult.differences.map((diff, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                diff.diffType === 'added'
                  ? 'bg-green-50 border-green-500'
                  : diff.diffType === 'removed'
                    ? 'bg-red-50 border-red-500'
                    : diff.diffType === 'modified'
                      ? 'bg-orange-50 border-orange-500'
                      : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    diff.diffType === 'added'
                      ? 'success'
                      : diff.diffType === 'removed'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-xs"
                >
                  {diff.diffType}
                </Badge>
                {diff.line1 && <span className="text-xs text-gray-600">Line {diff.line1}</span>}
                {diff.line2 && <span className="text-xs text-gray-600">→ Line {diff.line2}</span>}
                <Badge variant="outline" className="text-xs">
                  {diff.severity}
                </Badge>
              </div>

              <div className="space-y-2 text-sm font-mono">
                {diff.content1 && (
                  <div className="bg-red-100 p-2 rounded border-l-2 border-red-400">
                    <span className="text-red-700">- {diff.content1}</span>
                  </div>
                )}
                {diff.content2 && (
                  <div className="bg-green-100 p-2 rounded border-l-2 border-green-400">
                    <span className="text-green-700">+ {diff.content2}</span>
                  </div>
                )}
              </div>

              {diff.context && diff.context.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                    Show context ({diff.context.length} lines)
                  </summary>
                  <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded">
                    {diff.context.map((line, idx) => (
                      <div key={idx} className="text-gray-600">
                        {line}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  const renderSideBySideTab = () => {
    if (!comparisonResult) return null;
    const { file1, file2, comparisonType } = comparisonResult;

    if (comparisonType === 'image') {
      return (
        <div className="grid grid-cols-2 gap-4 h-96">
          {[file1, file2].map((file, i) => (
            <div key={i} className="border rounded-lg overflow-hidden flex flex-col">
              <div className="bg-gray-50 p-2 border-b shrink-0">
                <h3
                  className="font-medium text-sm truncate flex items-center gap-2"
                  title={file.path}
                >
                  <FileIcon className={`w-4 h-4 ${i === 0 ? 'text-blue-500' : 'text-green-500'}`} />
                  {file.name}
                  <span className="text-xs text-gray-400 ml-auto">{formatFileSize(file.size)}</span>
                </h3>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 bg-[#1a1a2e] overflow-auto">
                <img
                  src={convertAssetUrl(file.path)}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded"
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (comparisonType === 'video') {
      return (
        <div className="grid grid-cols-2 gap-4 h-96">
          {[file1, file2].map((file, i) => (
            <div key={i} className="border rounded-lg overflow-hidden flex flex-col">
              <div className="bg-gray-50 p-2 border-b shrink-0">
                <h3
                  className="font-medium text-sm truncate flex items-center gap-2"
                  title={file.path}
                >
                  <FileIcon className={`w-4 h-4 ${i === 0 ? 'text-blue-500' : 'text-green-500'}`} />
                  {file.name}
                  <span className="text-xs text-gray-400 ml-auto">{formatFileSize(file.size)}</span>
                </h3>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 bg-[#1a1a2e] overflow-auto">
                <video
                  src={convertAssetUrl(file.path)}
                  controls
                  className="max-w-full max-h-full rounded"
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (comparisonType !== 'text') {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <div className="text-lg font-medium">Side-by-side view not available</div>
          <div className="text-sm">
            This view is only available for text, image, and video files
          </div>
        </div>
      );
    }

    const lines1 = file1.lines || [];
    const lines2 = file2.lines || [];

    return (
      <div className="grid grid-cols-2 gap-4 h-96">
        <div className="border rounded-lg">
          <div className="bg-gray-50 p-2 border-b">
            <h3 className="font-medium text-sm truncate" title={file1.path}>
              {file1.name}
            </h3>
          </div>
          <ScrollArea className="h-80">
            <div className="p-2 font-mono text-xs">
              {lines1.map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-gray-400 select-none">{idx + 1}</span>
                  <span className="pl-2">{line}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="border rounded-lg">
          <div className="bg-gray-50 p-2 border-b">
            <h3 className="font-medium text-sm truncate" title={file2.path}>
              {file2.name}
            </h3>
          </div>
          <ScrollArea className="h-80">
            <div className="p-2 font-mono text-xs">
              {lines2.map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-gray-400 select-none">{idx + 1}</span>
                  <span className="pl-2">{line}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              File Comparison
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <div className="text-sm text-gray-600">Comparing files...</div>
              </div>
            </div>
          ) : comparisonResult ? (
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="differences">
                  Differences ({comparisonResult.differences.length})
                </TabsTrigger>
                <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
              </TabsList>

              <div className="mt-4 h-full">
                <TabsContent value="summary" className="mt-0 h-full">
                  {renderSummaryTab()}
                </TabsContent>
                <TabsContent value="differences" className="mt-0 h-full">
                  {renderDifferencesTab()}
                </TabsContent>
                <TabsContent value="side-by-side" className="mt-0 h-full">
                  {renderSideBySideTab()}
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <div className="text-lg font-medium">Comparison failed</div>
              <div className="text-sm">Unable to compare the selected files</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {comparisonResult && (
            <Button onClick={performComparison} disabled={loading}>
              Refresh Comparison
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FileComparisonDialog;
