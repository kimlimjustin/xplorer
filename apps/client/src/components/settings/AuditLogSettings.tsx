import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter,
  Calendar,
} from 'lucide-react';
import { SectionTitle, SelectField, Divider } from './shared';
import { TauriAPI } from '@/lib/tauri-api';
import type { AuditEntry } from '@/lib/tauri-api';

const PAGE_SIZE = 20;

const OPERATION_OPTIONS = [
  { value: 'all', label: 'All Operations' },
  { value: 'copy', label: 'Copy' },
  { value: 'move', label: 'Move' },
  { value: 'rename', label: 'Rename' },
  { value: 'delete', label: 'Delete' },
  { value: 'secure_delete', label: 'Secure Delete' },
  { value: 'compress', label: 'Compress' },
  { value: 'extract', label: 'Extract' },
  { value: 'encrypt', label: 'Encrypt' },
  { value: 'decrypt', label: 'Decrypt' },
];

const formatTimestamp = (iso: string) : string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const truncatePath = (path: string, maxLen = 50) : string => {
  if (path.length <= maxLen) return path;
  return '...' + path.slice(path.length - maxLen + 3);
}

const AuditLogSettings = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [operationFilter, setOperationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const fromISO = dateFrom ? new Date(dateFrom).toISOString() : undefined;
      const toISO = dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined;
      const filterValue = operationFilter === 'all' ? undefined : operationFilter;
      const result = await TauriAPI.getAuditLog(
        PAGE_SIZE,
        page * PAGE_SIZE,
        filterValue,
        fromISO,
        toISO,
      );
      setEntries(result.entries);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, operationFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    setPage(0);
  }, [operationFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      await TauriAPI.clearAuditLog();
      setConfirmClear(false);
      setPage(0);
      fetchLog();
    } catch (err) {
      console.error('Failed to clear audit log:', err);
    }
  };

  const handleExport = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultName = `xplorer_audit_log_${timestamp}.csv`;
      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!outputPath) return;
      await TauriAPI.exportAuditLog(outputPath);
      setExportStatus(`Exported to ${outputPath}`);
      setTimeout(() => setExportStatus(null), 5000);
    } catch (err) {
      setExportStatus(`Export failed: ${err}`);
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  return (
    <div className="space-y-1">
      <SectionTitle
        title="Filters"
        description="Narrow audit log results by operation or date range"
      />

      <div className="px-4 py-2 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-xp-text-secondary flex items-center gap-1">
            <Filter size={12} />
            Operation
          </label>
          <SelectField
            value={operationFilter}
            onChange={setOperationFilter}
            options={OPERATION_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-xp-text-secondary flex items-center gap-1">
            <Calendar size={12} />
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-xp-border bg-xp-bg text-xp-text"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-xp-text-secondary flex items-center gap-1">
            <Calendar size={12} />
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-xp-border bg-xp-bg text-xp-text"
          />
        </div>
      </div>

      <Divider />

      <SectionTitle
        title="Audit Entries"
        description={`${total} total entries${loading ? ' (loading...)' : ''}`}
      />

      {/* Table */}
      <div className="px-4">
        <div className="rounded-lg border border-xp-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-xp-surface-light/50 text-xp-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Timestamp</th>
                <th className="text-left px-3 py-2 font-medium">Operation</th>
                <th className="text-left px-3 py-2 font-medium">Paths</th>
                <th className="text-center px-3 py-2 font-medium w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-xp-text-secondary py-8 text-sm">
                    {loading ? 'Loading...' : 'No audit entries found'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-xp-border/30 hover:bg-xp-surface-light/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-xp-text-secondary whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${operationBadgeClass(entry.operation)}`}
                      >
                        {entry.operation}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-xp-text max-w-[300px]">
                      <div className="space-y-0.5">
                        {entry.paths.map((p, i) => (
                          <div key={i} className="truncate" title={p}>
                            {truncatePath(p)}
                          </div>
                        ))}
                      </div>
                      {entry.details && (
                        <div className="text-xp-text-secondary mt-0.5 italic">{entry.details}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.success ? (
                        <CheckCircle size={16} className="inline text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="inline text-red-400" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="text-xs text-xp-text-secondary">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md text-xp-text-secondary hover:bg-xp-surface hover:text-xp-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <Divider />

      <SectionTitle title="Actions" />

      <div className="px-4 py-2 flex flex-wrap items-center gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-xp-accent/15 text-xp-accent hover:bg-xp-accent/25 transition-colors"
        >
          <Download size={16} />
          Export to CSV
        </button>

        <button
          onClick={handleClear}
          onBlur={() => setConfirmClear(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            confirmClear
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'bg-red-500/10 text-red-400/70 hover:bg-red-500/20'
          }`}
        >
          <Trash2 size={16} />
          {confirmClear ? 'Click again to confirm' : 'Clear Log'}
        </button>
      </div>

      {exportStatus && (
        <div className="px-4 py-2">
          <div className="text-xs text-xp-text-secondary bg-xp-surface rounded-md px-3 py-2">
            {exportStatus}
          </div>
        </div>
      )}
    </div>
  );
}

const operationBadgeClass = (operation: string) : string => {
  switch (operation) {
    case 'copy':
      return 'bg-blue-500/15 text-blue-400';
    case 'move':
      return 'bg-purple-500/15 text-purple-400';
    case 'rename':
      return 'bg-cyan-500/15 text-cyan-400';
    case 'delete':
      return 'bg-red-500/15 text-red-400';
    case 'secure_delete':
      return 'bg-red-600/20 text-red-500';
    case 'compress':
      return 'bg-amber-500/15 text-amber-400';
    case 'extract':
      return 'bg-amber-500/15 text-amber-400';
    case 'encrypt':
      return 'bg-emerald-500/15 text-emerald-400';
    case 'decrypt':
      return 'bg-emerald-500/15 text-emerald-400';
    default:
      return 'bg-xp-surface text-xp-text-secondary';
  }
}

export default AuditLogSettings;
