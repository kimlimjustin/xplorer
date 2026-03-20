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
      <div className="flex items-center justify-center h-full text-xs text-xp-text-muted">
        No file selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-xp-text-muted">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-xp-blue mr-2" />
        Loading properties...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-xp-text-muted gap-2">
        <span className="text-red-400">Error: {error}</span>
        <button
          onClick={loadProperties}
          className="px-2 py-0.5 text-[10px] bg-xp-blue text-white rounded hover:bg-xp-blue-dark"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!properties) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-0.5 px-3 py-1 border-b border-xp-border bg-xp-surface-light/30">
        {(['general', 'permissions', 'details'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium capitalize ${
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
          className="px-2 py-0.5 text-[10px] rounded font-medium text-xp-text-muted hover:bg-xp-surface-light"
          title="Refresh properties"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'general' && (
          <div className="flex gap-6">
            {/* Left: file identity */}
            <div className="flex items-start gap-2 flex-shrink-0">
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
                <div className="text-xs font-medium text-xp-text truncate max-w-[200px]" title={properties.name}>
                  {properties.name}
                </div>
                <div className="text-[10px] text-xp-text-muted">{properties.file_type}</div>
                {/* Attribute badges */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {properties.is_hidden && (
                    <span className="px-1 py-0.5 bg-xp-yellow/20 text-xp-yellow rounded text-[9px]">Hidden</span>
                  )}
                  {properties.is_readonly && (
                    <span className="px-1 py-0.5 bg-xp-red/20 text-xp-red rounded text-[9px]">Read-only</span>
                  )}
                  {properties.is_directory && (
                    <span className="px-1 py-0.5 bg-xp-blue/20 text-xp-blue rounded text-[9px]">Directory</span>
                  )}
                  {properties.attributes.symlink_target && (
                    <span className="px-1 py-0.5 bg-xp-purple/20 text-xp-purple rounded text-[9px]">Symlink</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: properties grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs min-w-0">
              <PropRow label="Location" value={properties.path} />
              <PropRow label="Size" value={properties.size_formatted} />
              {properties.attributes.item_count != null && (
                <PropRow label="Contains" value={`${properties.attributes.item_count} items`} />
              )}
              {properties.attributes.total_size != null && (
                <PropRow label="Disk size" value={formatFileSize(properties.attributes.total_size)} />
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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xp-text-muted text-[10px] font-medium w-20">Permissions:</span>
              <input
                type="text"
                value={editingPermissions ? permissionString : properties.permissions.permissions_string}
                onChange={(e) => setPermissionString(e.target.value)}
                disabled={!editingPermissions}
                className="flex-1 px-2 py-1 text-[11px] border border-xp-border rounded bg-xp-bg text-xp-text disabled:opacity-50 disabled:cursor-not-allowed focus:ring-1 focus:ring-xp-blue"
                placeholder="e.g., 755 or readonly"
              />
              {editingPermissions ? (
                <>
                  <button
                    onClick={handleSavePermissions}
                    className="px-2 py-1 text-[10px] bg-xp-blue text-white rounded hover:bg-xp-blue-dark"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingPermissions(false);
                      setPermissionString(properties.permissions.permissions_string);
                    }}
                    className="px-2 py-1 text-[10px] bg-xp-surface-light text-xp-text rounded hover:bg-xp-border"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingPermissions(true)}
                  className="px-2 py-1 text-[10px] bg-xp-surface-light text-xp-text rounded hover:bg-xp-border"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-[9px] text-xp-text-muted">
              Use octal notation (e.g., 755) on Unix, or &apos;readonly&apos;/&apos;writable&apos; on Windows
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
              <PropRow label="Mode" value={`${Number(properties.permissions.mode).toString(8)} (octal)`} />
            )}
            {properties.permissions.attributes != null && (
              <PropRow label="Attributes" value={`0x${Number(properties.permissions.attributes).toString(16)} (hex)`} />
            )}
            <PropRow label="Size (bytes)" value={(properties.size ?? 0).toLocaleString()} />
            {properties.attributes.total_size != null && (
              <PropRow label="Total (bytes)" value={properties.attributes.total_size.toLocaleString()} />
            )}
            <PropRow label="Created (Unix)" value={String(properties.created ?? '')} />
            <PropRow label="Modified (Unix)" value={String(properties.modified ?? '')} />
            <PropRow label="Accessed (Unix)" value={String(properties.accessed ?? '')} />
          </div>
        )}
      </div>
    </div>
  );
}

const PropRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex items-baseline gap-1 py-0.5 min-w-0">
      <span className="text-xp-text-muted text-[10px] font-medium flex-shrink-0">{label}:</span>
      <span className="text-xp-text text-[11px] truncate" title={value}>{value}</span>
    </div>
  );
}

const PermBadge = ({ label, value }: { label: string; value: boolean }) => {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
      value
        ? 'bg-green-500/10 text-green-400'
        : 'bg-red-500/10 text-red-400'
    }`}>
      <span>{value ? '\u2713' : '\u2717'}</span>
      <span>{label}</span>
    </div>
  );
}

export default PropertiesPanel;
