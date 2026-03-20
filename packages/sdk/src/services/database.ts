import { transport } from '../transport';

export interface TableInfo {
  name: string;
  row_count: number;
  column_count: number;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value: string | null;
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
  total_rows: number;
}

export const listTables = async (path: string): Promise<TableInfo[]> => {
  return await transport('list_sqlite_tables', { path });
};

export const getTableColumns = async (
  path: string,
  table: string,
): Promise<ColumnInfo[]> => {
  return await transport('get_sqlite_table_columns', { path, table });
};

export const queryTable = async (
  path: string,
  table: string,
  limit: number,
  offset: number,
): Promise<QueryResult> => {
  return await transport('query_sqlite_table', { path, table, limit, offset });
};

export const executeQuery = async (
  path: string,
  query: string,
): Promise<QueryResult> => {
  return await transport('execute_sqlite_query', { path, query });
};
