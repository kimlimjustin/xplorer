import React, { useState, useEffect, useCallback } from 'react';
import { TauriAPI } from '@/lib/tauri-api';
import { getFileIcon, formatFileSize, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FileProperties {
  path: string;
  name: string;
  file_type: string;
  size: number;
  size_formatted: string;
  created: number;
  modified: number;
  accessed: number;
  created_formatted: string;
  modified_formatted: string;
  accessed_formatted: string;
  permissions: FilePermissions;
  is_directory: boolean;
  is_hidden: boolean;
  is_readonly: boolean;
  extension?: string;
  mime_type?: string;
  attributes: FileAttributes;
}

interface FilePermissions {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  permissions_string: string;
  mode?: number;
  attributes?: number;
}

interface FileAttributes {
  item_count?: number;
  total_size?: number;
  symlink_target?: string;
  device_id?: number;
  inode?: number;
  hard_links?: number;
}

interface PropertiesPanelProps {
  filePath: string;
}

const PropertiesPanel = ({ filePath }: PropertiesPanelProps) => {
  const { toast } = useToast();
  const [properties, setProperties] = useState<FileProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'details'>('general');
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [permissionString, setPermissionString] = useState('');

  const loadProperties = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    try {
      const props = await TauriAPI.getDetailedFileProperties(filePath);
      setProperties(props);
      setPermissionString(props.permissions.permissions_string);

      const parentDir = filePath.replace(/[\\/][^\\/]+$/, '');
      if (parentDir) {
        TauriAPI.addPathToTokenizer(parentDir).catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message);
      toast({
        title: 'Error Loading Properties',
        description: `Failed to load properties: ${(err as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filePath, toast]);

  useEffect(() => {
    if (filePath) {
      setActiveTab('general');
      setEditingPermissions(false);
      loadProperties();
    }
  }, [filePath, loadProperties]);

  const handleSavePermissions = async () => {
    if (!properties) return;
    try {
      await TauriAPI.setFilePermissions(filePath, permissionString);
      setEditingPermissions(false);
      loadProperties();
      toast({
        title: 'Permissions Updated',
        description: 'File permissions have been successfully updated.',
      });
    } catch (err) {
      toast({
        title: 'Error Updating Permissions',
        description: `Failed to update permissions: ${(err as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  if (!filePath) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center text-xs">
        No file selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center text-xs">
        <div className="border-xp-blue mr-2 h-4 w-4 animate-spin rounded-full border-b-2" />
        Loading properties...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center gap-2 text-xs">
        <span className="text-red-400">Error: {error}</span>
        <button
          onClick={loadProperties}
          className="bg-xp-blue hover:bg-xp-blue-dark rounded px-2 py-0.5 text-[10px] text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!properties) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab bar */}
      <div className="border-xp-border bg-xp-surface-light/30 flex items-center gap-0.5 border-b px-3 py-1">
        {(['general', 'permissions', 'details'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize ${
              activeTab === tab
                ? 'bg-xp-blue/20 text-xp-blue'
                : 'text-xp-text-muted hover:bg-xp-surface-light'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={loadProperties}
          className="text-xp-text-muted hover:bg-xp-surface-light rounded px-2 py-0.5 text-[10px] font-medium"
          title="Refresh properties"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'general' && (
          <div className="flex gap-6">
            {/* Left: file identity */}
            <div className="flex flex-shrink-0 items-start gap-2">
              <span className="text-2xl leading-none">
                {getFileIcon({
                  name: properties.name,
                  is_dir: properties.is_directory,
                  path: properties.path,
                  size: properties.size,
                  modified: properties.modified,
                  file_type: properties.file_type,
                })}
              </span>
              <div className="min-w-0">
                <div
                  className="text-xp-text max-w-[200px] truncate text-xs font-medium"
                  title={properties.name}
                >
                  {properties.name}
                </div>
                <div className="text-xp-text-muted text-[10px]">{properties.file_type}</div>
                {/* Attribute badges */}
                <div className="mt-1 flex flex-wrap gap-1">
                  {properties.is_hidden && (
                    <span className="bg-xp-yellow/20 text-xp-yellow rounded px-1 py-0.5 text-[9px]">
                      Hidden
                    </span>
                  )}
                  {properties.is_readonly && (
                    <span className="bg-xp-red/20 text-xp-red rounded px-1 py-0.5 text-[9px]">
                      Read-only
                    </span>
                  )}
                  {properties.is_directory && (
                    <span className="bg-xp-blue/20 text-xp-blue rounded px-1 py-0.5 text-[9px]">
                      Directory
                    </span>
                  )}
                  {properties.attributes.symlink_target && (
                    <span className="bg-xp-purple/20 text-xp-purple rounded px-1 py-0.5 text-[9px]">
                      Symlink
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: properties grid */}
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              <PropRow label="Location" value={properties.path} />
              <PropRow label="Size" value={properties.size_formatted} />
              {properties.attributes.item_count != null && (
                <PropRow label="Contains" value={`${properties.attributes.item_count} items`} />
              )}
              {properties.attributes.total_size != null && (
                <PropRow
                  label="Disk size"
                  value={formatFileSize(properties.attributes.total_size)}
                />
              )}
              <PropRow label="Created" value={formatDate(properties.created)} />
              <PropRow label="Modified" value={formatDate(properties.modified)} />
              <PropRow label="Accessed" value={formatDate(properties.accessed)} />
              {properties.extension && <PropRow label="Extension" value={properties.extension} />}
              {properties.mime_type && <PropRow label="MIME" value={properties.mime_type} />}
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <PermBadge label="Read" value={properties.permissions.readable} />
              <PermBadge label="Write" value={properties.permissions.writable} />
              <PermBadge label="Execute" value={properties.permissions.executable} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xp-text-muted w-20 text-[10px] font-medium">Permissions:</span>
              <input
                type="text"
                value={
                  editingPermissions ? permissionString : properties.permissions.permissions_string
                }
                onChange={(e) => setPermissionString(e.target.value)}
                disabled={!editingPermissions}
                className="border-xp-border bg-xp-bg text-xp-text focus:ring-xp-blue flex-1 rounded border px-2 py-1 text-[11px] focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g., 755 or readonly"
              />
              {editingPermissions ? (
                <>
                  <button
                    onClick={handleSavePermissions}
                    className="bg-xp-blue hover:bg-xp-blue-dark rounded px-2 py-1 text-[10px] text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingPermissions(false);
                      setPermissionString(properties.permissions.permissions_string);
                    }}
                    className="bg-xp-surface-light text-xp-text hover:bg-xp-border rounded px-2 py-1 text-[10px]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingPermissions(true)}
                  className="bg-xp-surface-light text-xp-text hover:bg-xp-border rounded px-2 py-1 text-[10px]"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-xp-text-muted text-[9px]">
              Use octal notation (e.g., 755) on Unix, or &apos;readonly&apos;/&apos;writable&apos;
              on Windows
            </p>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            {properties.attributes.device_id != null && (
              <PropRow label="Device ID" value={String(properties.attributes.device_id)} />
            )}
            {properties.attributes.inode != null && (
              <PropRow label="Inode" value={String(properties.attributes.inode)} />
            )}
            {properties.attributes.hard_links != null && (
              <PropRow label="Hard Links" value={String(properties.attributes.hard_links)} />
            )}
            {properties.attributes.symlink_target && (
              <PropRow label="Symlink Target" value={properties.attributes.symlink_target} />
            )}
            {properties.permissions.mode != null && (
              <PropRow
                label="Mode"
                value={`${Number(properties.permissions.mode).toString(8)} (octal)`}
              />
            )}
            {properties.permissions.attributes != null && (
              <PropRow
                label="Attributes"
                value={`0x${Number(properties.permissions.attributes).toString(16)} (hex)`}
              />
            )}
            <PropRow label="Size (bytes)" value={(properties.size ?? 0).toLocaleString()} />
            {properties.attributes.total_size != null && (
              <PropRow
                label="Total (bytes)"
                value={properties.attributes.total_size.toLocaleString()}
              />
            )}
            <PropRow label="Created (Unix)" value={String(properties.created ?? '')} />
            <PropRow label="Modified (Unix)" value={String(properties.modified ?? '')} />
            <PropRow label="Accessed (Unix)" value={String(properties.accessed ?? '')} />
          </div>
        )}
      </div>
    </div>
  );
};

const PropRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex min-w-0 items-baseline gap-1 py-0.5">
      <span className="text-xp-text-muted flex-shrink-0 text-[10px] font-medium">{label}:</span>
      <span className="text-xp-text truncate text-[11px]" title={value}>
        {value}
      </span>
    </div>
  );
};

const PermBadge = ({ label, value }: { label: string; value: boolean }) => {
  return (
    <div
      className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${
        value ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      }`}
    >
      <span>{value ? '\u2713' : '\u2717'}</span>
      <span>{label}</span>
    </div>
  );
};

export default PropertiesPanel;
