import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FileIcon, FolderIcon, Scale, X } from 'lucide-react';
import { TauriAPI } from '@/lib/tauri-api';

interface CompareFilesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCompare: (file1Path: string, file2Path: string) => void;
  initialFile1?: string;
  initialFile2?: string;
}

const CompareFilesDialog = ({
  isOpen,
  onClose,
  onCompare,
  initialFile1 = '',
  initialFile2 = '',
}: CompareFilesDialogProps) => {
  const [file1Path, setFile1Path] = useState(initialFile1);
  const [file2Path, setFile2Path] = useState(initialFile2);
  const [file1Info, setFile1Info] = useState<{ name: string; size: number; isDir: boolean } | null>(
    null,
  );
  const [file2Info, setFile2Info] = useState<{ name: string; size: number; isDir: boolean } | null>(
    null,
  );

  React.useEffect(() => {
    setFile1Path(initialFile1);
    setFile2Path(initialFile2);
    if (initialFile1) {
      validateFile(initialFile1, 1);
    }
    if (initialFile2) {
      validateFile(initialFile2, 2);
    }
  }, [initialFile1, initialFile2, isOpen]);

  const validateFile = async (path: string, fileNumber: 1 | 2) => {
    if (!path) {
      if (fileNumber === 1) setFile1Info(null);
      else setFile2Info(null);
      return;
    }

    try {
      const exists = await TauriAPI.fileExists(path);
      if (!exists) {
        if (fileNumber === 1) setFile1Info(null);
        else setFile2Info(null);
        return;
      }

      const isDir = await TauriAPI.isDir(path);
      if (isDir) {
        if (fileNumber === 1) setFile1Info(null);
        else setFile2Info(null);
        return;
      }

      const properties = await TauriAPI.getFileProperties(path);
      const info = {
        name: properties.name,
        size: properties.size,
        isDir: false,
      };

      if (fileNumber === 1) {
        setFile1Info(info);
      } else {
        setFile2Info(info);
      }
    } catch (error) {
      console.error('Error validating file:', error);
      if (fileNumber === 1) setFile1Info(null);
      else setFile2Info(null);
    }
  };

  const handleFile1Change = (value: string) => {
    setFile1Path(value);
    validateFile(value, 1);
  };

  const handleFile2Change = (value: string) => {
    setFile2Path(value);
    validateFile(value, 2);
  };

  const selectFile = async (fileNumber: 1 | 2) => {
    try {
      // Use Tauri dialog to select file
      const selected = await TauriAPI.showOpenDialog({
        multiple: false,
        directory: false,
        filters: [],
      });

      if (selected && selected.length > 0) {
        const path = selected[0];
        if (fileNumber === 1) {
          handleFile1Change(path);
        } else {
          handleFile2Change(path);
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error);
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

  const canCompare =
    file1Path && file2Path && file1Info && file2Info && !file1Info.isDir && !file2Info.isDir;

  const handleCompare = () => {
    if (canCompare) {
      onCompare(file1Path, file2Path);
    }
  };

  const renderFileInfo = (
    info: { name: string; size: number; isDir: boolean } | null,
    path: string,
  ) => {
    if (!path) return null;

    if (!info) {
      return (
        <Badge variant="destructive" className="text-xs">
          Invalid file or directory
        </Badge>
      );
    }

    if (info.isDir) {
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <FolderIcon className="w-3 h-3" />
          Directory (not supported)
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs gap-1">
        <FileIcon className="w-3 h-3" />
        {formatFileSize(info.size)}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Compare Files
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file1" className="text-sm font-medium">
                First File
              </Label>
              <div className="flex gap-2">
                <Input
                  id="file1"
                  placeholder="Select or enter path to first file..."
                  value={file1Path}
                  onChange={(e) => handleFile1Change(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => selectFile(1)} className="shrink-0">
                  Browse
                </Button>
              </div>
              <div className="min-h-6 flex items-center">
                {renderFileInfo(file1Info, file1Path)}
                {file1Path && file1Info && (
                  <span className="text-xs text-gray-600 ml-2 font-mono truncate">
                    {file1Info.name}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file2" className="text-sm font-medium">
                Second File
              </Label>
              <div className="flex gap-2">
                <Input
                  id="file2"
                  placeholder="Select or enter path to second file..."
                  value={file2Path}
                  onChange={(e) => handleFile2Change(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => selectFile(2)} className="shrink-0">
                  Browse
                </Button>
              </div>
              <div className="min-h-6 flex items-center">
                {renderFileInfo(file2Info, file2Path)}
                {file2Path && file2Info && (
                  <span className="text-xs text-gray-600 ml-2 font-mono truncate">
                    {file2Info.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {file1Path && file2Path && file1Path === file2Path && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <AlertTriangle size={14} className="inline-block mr-1" /> You have selected the same
                file for both comparisons. Please select two different files to compare.
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <div>• Both files must be regular files (not directories)</div>
            <div>• Large files may take longer to compare</div>
            <div>• Binary files will be compared byte-by-byte</div>
            <div>• Text files will be compared line-by-line with diff highlighting</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCompare}
            disabled={!canCompare || file1Path === file2Path}
            className="gap-2"
          >
            <Scale className="w-4 h-4" />
            Compare Files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CompareFilesDialog;
