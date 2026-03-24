use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use super::validate_file_path;

#[derive(Debug, Serialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: u64,
    pub column_count: u64,
}

#[derive(Debug, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total_rows: u64,
}

fn configure_connection(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = normal;
        PRAGMA temp_store = memory;
        PRAGMA mmap_size = 268435456;
        PRAGMA cache_size = -32000;
        PRAGMA foreign_keys = ON;
    ")
}

fn open_readonly(path: &str) -> Result<Connection, String> {
    validate_file_path(path)?;
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    configure_connection(&conn).map_err(|e| format!("Failed to configure database: {}", e))?;
    Ok(conn)
}

fn is_read_only_query(sql: &str) -> bool {
    let trimmed = sql.trim();
    // Strip leading comments (-- and /* */)
    let mut s = trimmed;
    loop {
        s = s.trim_start();
        if s.starts_with("--") {
            if let Some(pos) = s.find('\n') {
                s = &s[pos + 1..];
            } else {
                return false;
            }
        } else if s.starts_with("/*") {
            if let Some(pos) = s.find("*/") {
                s = &s[pos + 2..];
            } else {
                return false;
            }
        } else {
            break;
        }
    }
    let upper = s.to_uppercase();
    let allowed_prefixes = ["SELECT ", "PRAGMA ", "EXPLAIN ", "WITH "];
    allowed_prefixes.iter().any(|prefix| upper.starts_with(prefix))
}

#[tauri::command]
pub async fn list_sqlite_tables(path: String) -> Result<Vec<TableInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_readonly(&path)?;

        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).map_err(|e| format!("Failed to list tables: {}", e))?;

        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query tables: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        let mut tables = Vec::new();
        for name in table_names {
            let row_count: u64 = conn
                .query_row(
                    &format!("SELECT COUNT(*) FROM \"{}\"", name.replace('"', "\"\"")),
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            let mut col_stmt = conn
                .prepare(&format!("PRAGMA table_info(\"{}\")", name.replace('"', "\"\"")))
                .map_err(|e| format!("Failed to get column info: {}", e))?;
            let column_count = col_stmt
                .query_map([], |_| Ok(()))
                .map_err(|e| format!("Failed to count columns: {}", e))?
                .count() as u64;

            tables.push(TableInfo {
                name,
                row_count,
                column_count,
            });
        }

        Ok(tables)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn get_sqlite_table_columns(
    path: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_readonly(&path)?;
        let safe_table = table.replace('"', "\"\"");
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info(\"{}\")", safe_table))
            .map_err(|e| format!("Failed to get columns: {}", e))?;

        let columns: Vec<ColumnInfo> = stmt
            .query_map([], |row| {
                Ok(ColumnInfo {
                    name: row.get::<_, String>(1)?,
                    data_type: row.get::<_, String>(2).unwrap_or_default(),
                    is_nullable: row.get::<_, i32>(3).unwrap_or(1) == 0,
                    is_primary_key: row.get::<_, i32>(5).unwrap_or(0) != 0,
                    default_value: row.get::<_, Option<String>>(4).unwrap_or(None),
                })
            })
            .map_err(|e| format!("Failed to query columns: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(columns)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn query_sqlite_table(
    path: String,
    table: String,
    limit: u32,
    offset: u32,
) -> Result<QueryResult, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_readonly(&path)?;
        let safe_table = table.replace('"', "\"\"");

        let total_rows: u64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM \"{}\"", safe_table),
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let clamped_limit = limit.min(10000);
        let sql = format!(
            "SELECT * FROM \"{}\" LIMIT {} OFFSET {}",
            safe_table, clamped_limit, offset
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let col_count = columns.len();
        let rows: Vec<Vec<String>> = stmt
            .query_map([], |row| {
                let mut values = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val: String = match row.get_ref(i) {
                        Ok(rusqlite::types::ValueRef::Null) => "NULL".to_string(),
                        Ok(rusqlite::types::ValueRef::Integer(n)) => n.to_string(),
                        Ok(rusqlite::types::ValueRef::Real(f)) => f.to_string(),
                        Ok(rusqlite::types::ValueRef::Text(t)) => {
                            String::from_utf8_lossy(t).to_string()
                        }
                        Ok(rusqlite::types::ValueRef::Blob(b)) => {
                            format!("[BLOB {} bytes]", b.len())
                        }
                        Err(_) => "ERROR".to_string(),
                    };
                    values.push(val);
                }
                Ok(values)
            })
            .map_err(|e| format!("Failed to execute query: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(QueryResult {
            columns,
            rows,
            total_rows,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn execute_sqlite_query(
    path: String,
    query: String,
) -> Result<QueryResult, String> {
    if !is_read_only_query(&query) {
        return Err("Only SELECT, PRAGMA, EXPLAIN, and WITH queries are allowed".to_string());
    }

    tokio::task::spawn_blocking(move || {
        let conn = open_readonly(&path)?;

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("SQL error: {}", e))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let col_count = columns.len();
        let mut row_count: u64 = 0;
        let rows: Vec<Vec<String>> = stmt
            .query_map([], |row| {
                let mut values = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val: String = match row.get_ref(i) {
                        Ok(rusqlite::types::ValueRef::Null) => "NULL".to_string(),
                        Ok(rusqlite::types::ValueRef::Integer(n)) => n.to_string(),
                        Ok(rusqlite::types::ValueRef::Real(f)) => f.to_string(),
                        Ok(rusqlite::types::ValueRef::Text(t)) => {
                            String::from_utf8_lossy(t).to_string()
                        }
                        Ok(rusqlite::types::ValueRef::Blob(b)) => {
                            format!("[BLOB {} bytes]", b.len())
                        }
                        Err(_) => "ERROR".to_string(),
                    };
                    values.push(val);
                }
                Ok(values)
            })
            .map_err(|e| format!("Query execution failed: {}", e))?
            .filter_map(|r| {
                row_count += 1;
                if row_count <= 10000 {
                    r.ok()
                } else {
                    None
                }
            })
            .collect();

        Ok(QueryResult {
            columns,
            rows,
            total_rows: row_count,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_read_only_query() {
        assert!(is_read_only_query("SELECT * FROM users"));
        assert!(is_read_only_query("  select count(*) from orders  "));
        assert!(is_read_only_query("PRAGMA table_info(users)"));
        assert!(is_read_only_query("EXPLAIN SELECT * FROM users"));
        assert!(is_read_only_query("WITH cte AS (SELECT 1) SELECT * FROM cte"));
        assert!(is_read_only_query("-- comment\nSELECT 1"));
        assert!(is_read_only_query("/* block */  SELECT 1"));

        assert!(!is_read_only_query("INSERT INTO users VALUES (1)"));
        assert!(!is_read_only_query("UPDATE users SET name = 'x'"));
        assert!(!is_read_only_query("DELETE FROM users"));
        assert!(!is_read_only_query("DROP TABLE users"));
        assert!(!is_read_only_query("ALTER TABLE users ADD col TEXT"));
        assert!(!is_read_only_query("CREATE TABLE t (id INT)"));
        assert!(!is_read_only_query(""));
    }
}
