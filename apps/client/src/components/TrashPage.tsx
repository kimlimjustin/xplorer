import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TauriAPI, type TrashItem } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';
import { getFileIcon, formatFileSize, formatDate } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { showConfirmationToast } from '@/components/ui/Toast';

interface RecycleBinProps {
  onClose?: () => void;
}

const RecycleBin = ({ onClose }: RecycleBinProps) => {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Query trash items
  const {
    data: trashItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['trash-items'],
    queryFn: () => TauriAPI.getTrashItems(),
    staleTime: 30000,
  });

  // Show toast notification for errors
  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error Loading Recycle Bin',
        description: `Failed to load recycle bin items: ${(error as Error).message}`,
      });
    }
  }, [error, toast]);

  const handleSelectItem = (original_path: string, event?: React.MouseEvent) => {
    if (event && (event.ctrlKey || event.metaKey)) {
      // Ctrl+click for multi-select
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(original_path)) {
          newSet.delete(original_path);
        } else {
          newSet.add(original_path);
        }
        return newSet;
      });
    } else {
      // Single select
      setSelectedItems(new Set([original_path]));
    }
  };

  const handleRestore = async (itemPath?: string) => {
    // For restoration, we need to use the actual trash item path, not the original path
    const trashItemsToRestore = itemPath
      ? [itemPath]
      : Array.from(selectedItems).map((original_path) => {
          const item = trashItems.find((t) => t.original_path === original_path);
          return item ? getTrashItemPath(item) : original_path;
        });

    if (trashItemsToRestore.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Items Selected',
        description: 'Please select items to restore',
      });
      return;
    }

    const confirmed = await showConfirmationToast({
      title: 'Restore Items',
      description: `Are you sure you want to restore ${trashItemsToRestore.length} item(s) to their original locations?`,
      confirmText: 'Restore',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const restoredPaths: string[] = [];
      for (const trashPath of trashItemsToRestore) {
        const restoredPath = await TauriAPI.restoreFromTrash(trashPath);
        restoredPaths.push(restoredPath);
      }

      setSelectedItems(new Set());
      refetch();

      toast({
        title: 'Items Restored',
        description: `Successfully restored ${restoredPaths.length} item(s) to their original locations`,
      });
    } catch (error) {
      console.error('Failed to restore items:', error);
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: `Failed to restore items: ${(error as Error).message}`,
      });
    }
  };

  // Helper function to get the actual trash item path (this might need adjustment based on the TrashItem structure)
  const getTrashItemPath = (item: TrashItem): string => {
    // If the item has a specific trash path, use it; otherwise use original path as fallback
    return 'trashPath' in item &&
      typeof (item as TrashItem & { trashPath?: string }).trashPath === 'string'
      ? (item as TrashItem & { trashPath: string }).trashPath
      : item.original_path;
  };

  const handlePermanentDelete = async (original_path?: string) => {
    // For permanent deletion, we need to use the actual trash item paths
    const trashItemsToDelete = original_path
      ? [original_path]
      : Array.from(selectedItems).map((original_path) => {
          const item = trashItems.find((t) => t.original_path === original_path);
          return item ? getTrashItemPath(item) : original_path;
        });

    if (trashItemsToDelete.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Items Selected',
        description: 'Please select items to permanently delete',
      });
      return;
    }

    const confirmed = await showConfirmationToast({
      title: 'Permanently Delete Items',
      description: `Are you sure you want to permanently delete ${trashItemsToDelete.length} item(s)? This action cannot be undone.`,
      confirmText: 'Permanently Delete',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    try {
      for (const trashPath of trashItemsToDelete) {
        await TauriAPI.permanentlyDeleteFromTrash(trashPath);
      }

      setSelectedItems(new Set());
      refetch();

      toast({
        title: 'Items Permanently Deleted',
        description: `Successfully deleted ${trashItemsToDelete.length} item(s) permanently`,
      });
    } catch (error) {
      console.error('Failed to permanently delete items:', error);
      toast({
        variant: 'destructive',
        title: 'Permanent Delete Failed',
        description: `Failed to permanently delete items: ${(error as Error).message}`,
      });
    }
  };

  const handleEmptyTrash = async () => {
    if (trashItems.length === 0) {
      toast({
        title: 'Recycle Bin Empty',
        description: 'The recycle bin is already empty',
      });
      return;
    }

    const confirmed = await showConfirmationToast({
      title: 'Empty Recycle Bin',
      description: `Are you sure you want to permanently delete all ${trashItems.length} item(s) in the recycle bin? This action cannot be undone.`,
      confirmText: 'Empty Recycle Bin',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const deletedCount = await TauriAPI.emptyTrash();
      setSelectedItems(new Set());
      refetch();

      toast({
        title: 'Recycle Bin Emptied',
        description: `Successfully deleted ${deletedCount} item(s) from the recycle bin`,
      });
    } catch (error) {
      console.error('Failed to empty trash:', error);
      toast({
        variant: 'destructive',
        title: 'Empty Recycle Bin Failed',
        description: `Failed to empty recycle bin: ${(error as Error).message}`,
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.size === trashItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(trashItems.map((item) => item.original_path)));
    }
  };

  return (
    <div className="bg-xp-bg text-xp-text flex h-full flex-col">
      {/* Header */}
      <div className="border-xp-border flex items-center justify-between border-b p-4">
        <h2 className="text-xp-text flex items-center gap-2 text-xl font-semibold">
          <Trash2 size={20} /> Recycle Bin
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAll}
            className="bg-xp-surface hover:bg-xp-surface-light border-xp-border rounded border px-3 py-1 text-sm"
            aria-label={
              selectedItems.size === trashItems.length ? 'Deselect all items' : 'Select all items'
            }
          >
            {selectedItems.size === trashItems.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={() => handleRestore()}
            disabled={selectedItems.size === 0}
            className="bg-xp-blue rounded px-3 py-1 text-sm text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Restore ${selectedItems.size} selected items`}
          >
            Restore ({selectedItems.size})
          </button>
          <button
            onClick={() => handlePermanentDelete()}
            disabled={selectedItems.size === 0}
            className="bg-xp-red rounded px-3 py-1 text-sm text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Permanently delete ${selectedItems.size} selected items`}
          >
            Delete Permanently ({selectedItems.size})
          </button>
          <button
            onClick={handleEmptyTrash}
            disabled={trashItems.length === 0}
            className="bg-xp-red rounded px-3 py-1 text-sm text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Empty recycle bin"
          >
            Empty Recycle Bin
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-xp-surface hover:bg-xp-surface-light border-xp-border rounded border px-3 py-1 text-sm"
              aria-label="Back to home"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {(() => {
          if (isLoading) {
            return (
              <div className="flex h-full items-center justify-center">
                <div className="text-xp-text-muted">Loading recycle bin items...</div>
              </div>
            );
          }
          if (trashItems.length === 0) {
            return (
              <div className="flex h-full items-center justify-center">
                <div className="text-xp-text-muted text-center">
                  <div className="mb-4 text-4xl">
                    <Trash2 size="1em" className="text-xp-text-muted inline-block" />
                  </div>
                  <div className="text-lg">Recycle Bin is empty</div>
                  <div className="mt-2 text-sm">Deleted files will appear here</div>
                </div>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 gap-2">
              {trashItems.map((item) => (
                <div
                  key={item.original_path}
                  onClick={(e) => handleSelectItem(item.original_path, e)}
                  className={`hover:bg-xp-surface flex cursor-pointer items-center rounded p-3 ${
                    selectedItems.has(item.original_path) ? 'bg-xp-accent bg-opacity-20' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <div className="mr-3 text-xl">
                      {getFileIcon({
                        name: item.name,
                        is_dir: item.is_dir,
                        path: item.original_path,
                        size: item.size,
                        modified: item.deletion_date,
                        file_type: item.name.split('.').pop() || '',
                        is_readonly: false,
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xp-text truncate font-medium">{item.name}</div>
                      <div className="text-xp-text-muted truncate text-sm">
                        {item.original_path}
                      </div>
                    </div>
                    <div className="text-xp-text-muted ml-4 text-sm">
                      {!item.is_dir && formatFileSize(item.size)}
                    </div>
                    <div className="text-xp-text-muted ml-4 text-sm">
                      {formatDate(item.deletion_date * 1000)}
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(item.original_path);
                        }}
                        className="bg-xp-blue rounded px-2 py-1 text-xs text-white hover:opacity-80"
                        aria-label={`Restore ${item.name}`}
                      >
                        Restore
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePermanentDelete(item.original_path);
                        }}
                        className="bg-xp-red rounded px-2 py-1 text-xs text-white hover:opacity-80"
                        aria-label={`Permanently delete ${item.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="border-xp-border text-xp-text-muted border-t p-4 text-sm">
        {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in recycle bin
        {selectedItems.size > 0 && ` • ${selectedItems.size} selected`}
      </div>
    </div>
  );
};

export default RecycleBin;
