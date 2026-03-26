import React from 'react';
import { Editor, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface TableInfo {
  name: string;
  row_count: number;
  column_count: number;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value: string | null;
}

interface QueryResult {
  columns: string[];
  rows: string[][];
  total_rows: number;
}

// ── Icons (inline SVGs) ──────────────────────────────────────────────────────

function DatabaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || 'Database';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ── Table List Sidebar ───────────────────────────────────────────────────────

function TableList(props: {
  tables: TableInfo[];
  selectedTable: string | null;
  onSelect: (name: string) => void;
  loading: boolean;
}) {
  const { tables, selectedTable, onSelect, loading } = props;

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      borderRight: '1px solid var(--xp-border)',
      backgroundColor: 'var(--xp-surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--xp-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--xp-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <DatabaseIcon />
        Tables ({tables.length})
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          <div style={{ padding: '12px', color: 'var(--xp-text-muted)', fontSize: 12, textAlign: 'center' }}>
            Loading tables...
          </div>
        )}
        {!loading && tables.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--xp-text-muted)', fontSize: 12, textAlign: 'center' }}>
            No tables found
          </div>
        )}
        {tables.map(table => (
          <button
            key={table.name}
            onClick={() => onSelect(table.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              textAlign: 'left',
              backgroundColor: selectedTable === table.name
                ? 'rgba(122, 162, 247, 0.15)'
                : 'transparent',
              color: selectedTable === table.name
                ? '#7aa2f7'
                : 'var(--xp-text)',
              borderLeft: selectedTable === table.name
                ? '2px solid #7aa2f7'
                : '2px solid transparent',
            }}
          >
            <span style={{ color: selectedTable === table.name ? '#7aa2f7' : 'var(--xp-text-muted)', flexShrink: 0 }}>
              <TableIcon />
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {table.name}
            </span>
            <span style={{
              fontSize: 10,
              color: 'var(--xp-text-muted)',
              flexShrink: 0,
            }}>
              {formatNumber(table.row_count)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Column Header with type info ─────────────────────────────────────────────

function ColumnHeader(props: { name: string; columnInfo?: ColumnInfo }) {
  const { name, columnInfo } = props;
  return (
    <th style={{
      padding: '6px 12px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--xp-text)',
      backgroundColor: 'var(--xp-surface)',
      borderBottom: '2px solid var(--xp-border)',
      borderRight: '1px solid var(--xp-border)',
      whiteSpace: 'nowrap',
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {columnInfo?.is_primary_key && (
          <span style={{ color: '#e0af68', flexShrink: 0 }} title="Primary Key">
            <KeyIcon />
          </span>
        )}
        <span>{name}</span>
        {columnInfo?.data_type && (
          <span style={{
            fontSize: 9,
            color: 'var(--xp-text-muted)',
            fontWeight: 400,
            marginLeft: 2,
          }}>
            {columnInfo.data_type}
          </span>
        )}
      </div>
    </th>
  );
}

// ── Data Grid ────────────────────────────────────────────────────────────────

function DataGrid(props: {
  result: QueryResult | null;
  columnInfos: ColumnInfo[];
  loading: boolean;
  error: string | null;
}) {
  const { result, columnInfos, loading, error } = props;

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--xp-text-muted)', fontSize: 13,
      }}>
        Loading data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#f7768e', fontSize: 13, padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Query Error</div>
          <div style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-word' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--xp-text-muted)', fontSize: 13,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <DatabaseIcon />
          </div>
          Select a table to view its data
        </div>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--xp-text-muted)', fontSize: 13,
      }}>
        Table is empty (0 rows)
      </div>
    );
  }

  const columnMap = new Map<string, ColumnInfo>();
  for (const col of columnInfos) {
    columnMap.set(col.name, col);
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      }}>
        <thead>
          <tr>
            <th style={{
              padding: '6px 10px',
              textAlign: 'right',
              fontSize: 10,
              fontWeight: 400,
              color: 'var(--xp-text-muted)',
              backgroundColor: 'var(--xp-surface)',
              borderBottom: '2px solid var(--xp-border)',
              borderRight: '1px solid var(--xp-border)',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              width: 40,
            }}>
              #
            </th>
            {result.columns.map(col => (
              <ColumnHeader key={col} name={col} columnInfo={columnMap.get(col)} />
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              style={{
                backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <td style={{
                padding: '4px 10px',
                textAlign: 'right',
                fontSize: 10,
                color: 'var(--xp-text-muted)',
                borderRight: '1px solid var(--xp-border)',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                width: 40,
              }}>
                {rowIdx + 1}
              </td>
              {row.map((cell, colIdx) => (
                <td
                  key={colIdx}
                  title={cell}
                  style={{
                    padding: '4px 12px',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: cell === 'NULL'
                      ? 'var(--xp-text-muted)'
                      : cell.startsWith('[BLOB')
                        ? '#bb9af7'
                        : 'var(--xp-text)',
                    fontStyle: cell === 'NULL' ? 'italic' : 'normal',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination Controls ──────────────────────────────────────────────────────

function Pagination(props: {
  currentPage: number;
  totalRows: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rpp: number) => void;
}) {
  const { currentPage, totalRows, rowsPerPage, onPageChange, onRowsPerPageChange } = props;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const start = currentPage * rowsPerPage + 1;
  const end = Math.min((currentPage + 1) * rowsPerPage, totalRows);

  const btnStyle: React.CSSProperties = {
    padding: '3px 8px',
    border: '1px solid var(--xp-border)',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: 'var(--xp-text-muted)',
    cursor: 'pointer',
    fontSize: 11,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  };

  const disabledBtnStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.4,
    cursor: 'default',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 12px',
      borderTop: '1px solid var(--xp-border)',
      backgroundColor: 'var(--xp-surface)',
      fontSize: 11,
      color: 'var(--xp-text-muted)',
      flexShrink: 0,
      minHeight: 32,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={e => onRowsPerPageChange(parseInt(e.target.value, 10))}
          style={{
            padding: '2px 4px',
            border: '1px solid var(--xp-border)',
            borderRadius: 4,
            backgroundColor: 'var(--xp-bg)',
            color: 'var(--xp-text)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{formatNumber(start)}-{formatNumber(end)} of {formatNumber(totalRows)}</span>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 0}
          style={currentPage <= 0 ? disabledBtnStyle : btnStyle}
          title="Previous page"
        >
          <ChevronLeftIcon />
        </button>
        <span>Page {currentPage + 1} of {formatNumber(totalPages)}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          style={currentPage >= totalPages - 1 ? disabledBtnStyle : btnStyle}
          title="Next page"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

// ── Query Input ──────────────────────────────────────────────────────────────

function QueryInput(props: {
  onExecute: (sql: string) => void;
  loading: boolean;
}) {
  const [sql, setSql] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (sql.trim()) props.onExecute(sql.trim());
    }
  };

  return (
    <div style={{
      borderBottom: '1px solid var(--xp-border)',
      backgroundColor: 'var(--xp-surface)',
      flexShrink: 0,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--xp-text-muted)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        SQL Query
      </div>
      {expanded && (
        <div style={{ padding: '0 12px 8px 12px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM table_name LIMIT 100"
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: 60,
                maxHeight: 200,
                padding: '8px 10px',
                border: '1px solid var(--xp-border)',
                borderRadius: 4,
                backgroundColor: 'var(--xp-bg)',
                color: 'var(--xp-text)',
                fontSize: 12,
                fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <button
              onClick={() => { if (sql.trim()) props.onExecute(sql.trim()); }}
              disabled={props.loading || !sql.trim()}
              title="Execute Query (Ctrl+Enter)"
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRadius: 4,
                backgroundColor: !sql.trim() || props.loading ? 'var(--xp-surface-light)' : '#7aa2f7',
                color: !sql.trim() || props.loading ? 'var(--xp-text-muted)' : '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: !sql.trim() || props.loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <PlayIcon />
              Run
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--xp-text-muted)', marginTop: 4 }}>
            Read-only: SELECT, PRAGMA, EXPLAIN, WITH queries only. Press Ctrl+Enter to execute.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schema Panel ─────────────────────────────────────────────────────────────

function SchemaPanel(props: {
  columns: ColumnInfo[];
  tableName: string;
}) {
  const { columns, tableName } = props;
  const [visible, setVisible] = React.useState(false);

  if (!tableName || columns.length === 0) return null;

  return (
    <div style={{
      borderBottom: '1px solid var(--xp-border)',
      backgroundColor: 'var(--xp-surface)',
      flexShrink: 0,
    }}>
      <div
        onClick={() => setVisible(!visible)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--xp-text-muted)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: visible ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <ColumnsIcon />
        Schema: {tableName} ({columns.length} columns)
      </div>
      {visible && (
        <div style={{ padding: '0 12px 8px 12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--xp-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--xp-border)' }}>Column</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--xp-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--xp-border)' }}>Type</th>
                <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--xp-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--xp-border)' }}>PK</th>
                <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--xp-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--xp-border)' }}>Nullable</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--xp-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--xp-border)' }}>Default</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(col => (
                <tr key={col.name}>
                  <td style={{ padding: '3px 8px', color: 'var(--xp-text)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.is_primary_key && <span style={{ color: '#e0af68' }}><KeyIcon /></span>}
                      {col.name}
                    </span>
                  </td>
                  <td style={{ padding: '3px 8px', color: '#2ac3de', fontFamily: 'monospace' }}>{col.data_type || '-'}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'center', color: col.is_primary_key ? '#e0af68' : 'var(--xp-text-muted)' }}>{col.is_primary_key ? 'Yes' : '-'}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'center', color: 'var(--xp-text-muted)' }}>{col.is_nullable ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--xp-text-muted)', fontFamily: 'monospace' }}>{col.default_value ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main SQLite Browser Component ────────────────────────────────────────────

function SQLiteBrowser(props: { filePath: string; api: XplorerAPI }) {
  const { filePath, api } = props;

  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = React.useState(true);
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null);
  const [columnInfos, setColumnInfos] = React.useState<ColumnInfo[]>([]);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [isCustomQuery, setIsCustomQuery] = React.useState(false);
  const [dbError, setDbError] = React.useState<string | null>(null);

  // Load tables on mount or when filePath changes
  React.useEffect(() => {
    let cancelled = false;
    setTablesLoading(true);
    setTables([]);
    setSelectedTable(null);
    setResult(null);
    setError(null);
    setColumnInfos([]);
    setDbError(null);

    api.database.listTables(filePath).then(tableList => {
      if (cancelled) return;
      setTables(tableList);
      setTablesLoading(false);
      if (tableList.length > 0) {
        setSelectedTable(tableList[0].name);
      }
    }).catch(err => {
      if (cancelled) return;
      setTablesLoading(false);
      setDbError(String(err?.message || err));
    });

    return () => { cancelled = true; };
  }, [filePath]);

  // Load table data when selected table or pagination changes
  React.useEffect(() => {
    if (!selectedTable || isCustomQuery) return;
    let cancelled = false;
    setDataLoading(true);
    setError(null);

    const offset = currentPage * rowsPerPage;

    Promise.all([
      api.database.queryTable(filePath, selectedTable, rowsPerPage, offset),
      api.database.getTableColumns(filePath, selectedTable),
    ]).then(([queryResult, cols]) => {
      if (cancelled) return;
      setResult(queryResult);
      setColumnInfos(cols);
      setDataLoading(false);
    }).catch(err => {
      if (cancelled) return;
      setError(String(err?.message || err));
      setDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedTable, currentPage, rowsPerPage, isCustomQuery, filePath]);

  const handleTableSelect = (name: string) => {
    setSelectedTable(name);
    setCurrentPage(0);
    setIsCustomQuery(false);
    setError(null);
  };

  const handleExecuteQuery = (sql: string) => {
    setDataLoading(true);
    setError(null);
    setIsCustomQuery(true);

    api.database.executeQuery(filePath, sql).then(queryResult => {
      setResult(queryResult);
      setColumnInfos([]);
      setDataLoading(false);
    }).catch(err => {
      setError(String(err?.message || err));
      setResult(null);
      setDataLoading(false);
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (rpp: number) => {
    setRowsPerPage(rpp);
    setCurrentPage(0);
  };

  const fileName = getFileName(filePath);

  if (dbError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', backgroundColor: 'var(--xp-bg)', fontFamily: 'sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 500 }}>
          <div style={{ fontSize: 14, color: '#f7768e', marginBottom: 8, fontWeight: 600 }}>
            Failed to open database
          </div>
          <div style={{ fontSize: 12, color: 'var(--xp-text-muted)', wordBreak: 'break-word' }}>
            {dbError}
          </div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 12 }}>
            {fileName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: 'var(--xp-bg)', color: 'var(--xp-text)',
      fontFamily: 'sans-serif', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minHeight: 36,
        backgroundColor: 'var(--xp-surface)',
        borderBottom: '1px solid var(--xp-border)',
        fontSize: 12, flexShrink: 0,
      }}>
        <span style={{ color: 'var(--xp-text-muted)', flexShrink: 0 }}>
          <DatabaseIcon />
        </span>
        <span style={{ fontWeight: 600, color: 'var(--xp-text)' }}>
          {fileName}
        </span>
        {tables.length > 0 && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            backgroundColor: 'rgba(122, 162, 247, 0.15)', color: '#7aa2f7',
          }}>
            {tables.length} table{tables.length !== 1 ? 's' : ''}
          </span>
        )}
        {selectedTable && !isCustomQuery && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            backgroundColor: 'rgba(158, 206, 106, 0.15)', color: '#9ece6a',
          }}>
            {selectedTable}
          </span>
        )}
        {isCustomQuery && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            backgroundColor: 'rgba(224, 175, 104, 0.15)', color: '#e0af68',
          }}>
            Custom Query
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--xp-text-muted)' }}>
          Read-only
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Table list sidebar */}
        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelect={handleTableSelect}
          loading={tablesLoading}
        />

        {/* Data area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Query input */}
          <QueryInput onExecute={handleExecuteQuery} loading={dataLoading} />

          {/* Schema panel */}
          {selectedTable && !isCustomQuery && (
            <SchemaPanel columns={columnInfos} tableName={selectedTable} />
          )}

          {/* Data grid */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <DataGrid
              result={result}
              columnInfos={columnInfos}
              loading={dataLoading}
              error={error}
            />
          </div>

          {/* Pagination */}
          {result && result.total_rows > 0 && !isCustomQuery && (
            <Pagination
              currentPage={currentPage}
              totalRows={result.total_rows}
              rowsPerPage={rowsPerPage}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}

          {/* Status bar for custom queries */}
          {isCustomQuery && result && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '4px 12px', minHeight: 28,
              backgroundColor: 'var(--xp-surface)',
              borderTop: '1px solid var(--xp-border)',
              fontSize: 11, color: 'var(--xp-text-muted)',
              flexShrink: 0,
            }}>
              <span>{formatNumber(result.rows.length)} row{result.rows.length !== 1 ? 's' : ''} returned</span>
              <span>{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Register Editor ──────────────────────────────────────────────────────────

let api: XplorerAPI;

Editor.register({
  id: 'sqlite-browser',
  title: 'SQLite Browser',
  extensions: ['db', 'sqlite', 'sqlite3'],
  priority: 30,
  permissions: ['file:read', 'files:read'],
  render: ({ filePath }) => React.createElement(SQLiteBrowser, { filePath, api }),
  onActivate: (injectedApi) => { api = injectedApi; },
});
