use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::command;

const RING_BUFFER_CAPACITY: usize = 10_000;
const AUDIT_LOG_FILE: &str = "audit_log.json";
const FLUSH_INTERVAL: usize = 50;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditEntry {
    pub id: u64,
    pub timestamp: String,
    pub operation: String,
    pub paths: Vec<String>,
    pub user: String,
    pub details: Option<String>,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLogQuery {
    pub entries: Vec<AuditEntry>,
    pub total: usize,
}

struct AuditLog {
    entries: VecDeque<AuditEntry>,
    next_id: u64,
    pending_writes: usize,
}

impl AuditLog {
    fn new() -> Self {
        let mut log = Self {
            entries: VecDeque::with_capacity(RING_BUFFER_CAPACITY),
            next_id: 1,
            pending_writes: 0,
        };
        log.load_from_disk();
        log
    }

    fn log_file_path() -> Option<PathBuf> {
        dirs::data_local_dir().map(|d| d.join("com.xplorer.app").join(AUDIT_LOG_FILE))
    }

    fn load_from_disk(&mut self) {
        let Some(path) = Self::log_file_path() else { return };
        if !path.exists() {
            return;
        }
        let Ok(data) = fs::read_to_string(&path) else { return };
        let Ok(entries) = serde_json::from_str::<Vec<AuditEntry>>(&data) else { return };
        for entry in entries {
            if entry.id >= self.next_id {
                self.next_id = entry.id + 1;
            }
            self.entries.push_back(entry);
        }
        while self.entries.len() > RING_BUFFER_CAPACITY {
            self.entries.pop_front();
        }
    }

    fn flush_to_disk(&self) {
        let Some(path) = Self::log_file_path() else { return };
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let entries: Vec<&AuditEntry> = self.entries.iter().collect();
        if let Ok(json) = serde_json::to_string(&entries) {
            let _ = fs::write(&path, json);
        }
    }

    fn add_entry(
        &mut self,
        operation: String,
        paths: Vec<String>,
        details: Option<String>,
        success: bool,
    ) {
        let entry = AuditEntry {
            id: self.next_id,
            timestamp: Utc::now().to_rfc3339(),
            operation,
            paths,
            user: whoami(),
            details,
            success,
        };
        self.next_id += 1;
        self.entries.push_back(entry);
        while self.entries.len() > RING_BUFFER_CAPACITY {
            self.entries.pop_front();
        }
        self.pending_writes += 1;
        if self.pending_writes >= FLUSH_INTERVAL {
            self.flush_to_disk();
            self.pending_writes = 0;
        }
    }

    fn query(
        &self,
        limit: usize,
        offset: usize,
        operation_filter: Option<&str>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> AuditLogQuery {
        let filtered: Vec<&AuditEntry> = self
            .entries
            .iter()
            .rev()
            .filter(|e| {
                if let Some(op) = operation_filter {
                    if !op.is_empty() && e.operation != op {
                        return false;
                    }
                }
                if let Some(from) = date_from {
                    if !from.is_empty() && e.timestamp.as_str() < from {
                        return false;
                    }
                }
                if let Some(to) = date_to {
                    if !to.is_empty() && e.timestamp.as_str() > to {
                        return false;
                    }
                }
                true
            })
            .collect();

        let total = filtered.len();
        let entries: Vec<AuditEntry> = filtered
            .into_iter()
            .skip(offset)
            .take(limit)
            .cloned()
            .collect();

        AuditLogQuery { entries, total }
    }

    fn clear(&mut self) {
        self.entries.clear();
        self.pending_writes = 0;
        self.flush_to_disk();
    }

    fn export_csv(&self, output_path: &str) -> Result<(), String> {
        let mut csv = String::from("id,timestamp,operation,paths,user,details,success\n");
        for entry in &self.entries {
            let paths_joined = entry.paths.join(";");
            let details = entry.details.as_deref().unwrap_or("");
            csv.push_str(&format!(
                "{},\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",{}\n",
                entry.id,
                entry.timestamp,
                entry.operation,
                paths_joined.replace('"', "\"\""),
                entry.user,
                details.replace('"', "\"\""),
                entry.success
            ));
        }
        fs::write(output_path, csv)
            .map_err(|e| format!("Failed to write CSV: {}", e))?;
        Ok(())
    }
}

fn whoami() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown".to_string())
}

static AUDIT_LOG: LazyLock<Mutex<AuditLog>> = LazyLock::new(|| Mutex::new(AuditLog::new()));

pub fn log_operation(operation: &str, paths: Vec<String>, details: Option<String>, success: bool) {
    let mut log = AUDIT_LOG.lock().unwrap_or_else(|e| e.into_inner());
    log.add_entry(operation.to_string(), paths, details, success);
}

#[command]
pub async fn get_audit_log(
    limit: Option<usize>,
    offset: Option<usize>,
    operation_filter: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<AuditLogQuery, String> {
    let log = AUDIT_LOG.lock().unwrap_or_else(|e| e.into_inner());
    Ok(log.query(
        limit.unwrap_or(50),
        offset.unwrap_or(0),
        operation_filter.as_deref(),
        date_from.as_deref(),
        date_to.as_deref(),
    ))
}

#[command]
pub async fn clear_audit_log() -> Result<(), String> {
    let mut log = AUDIT_LOG.lock().unwrap_or_else(|e| e.into_inner());
    log.clear();
    Ok(())
}

#[command]
pub async fn export_audit_log(output_path: String) -> Result<(), String> {
    let log = AUDIT_LOG.lock().unwrap_or_else(|e| e.into_inner());
    log.export_csv(&output_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_entry_creation() {
        let entry = AuditEntry {
            id: 1,
            timestamp: Utc::now().to_rfc3339(),
            operation: "copy".to_string(),
            paths: vec!["/src/a.txt".to_string(), "/dst/a.txt".to_string()],
            user: "testuser".to_string(),
            details: Some("test copy".to_string()),
            success: true,
        };
        assert_eq!(entry.id, 1);
        assert_eq!(entry.operation, "copy");
        assert!(entry.success);
    }

    #[test]
    fn test_ring_buffer_capacity() {
        let mut log = AuditLog {
            entries: VecDeque::with_capacity(RING_BUFFER_CAPACITY),
            next_id: 1,
            pending_writes: 0,
        };
        for i in 0..RING_BUFFER_CAPACITY + 100 {
            log.add_entry(
                "test".to_string(),
                vec![format!("/path/{}", i)],
                None,
                true,
            );
        }
        assert_eq!(log.entries.len(), RING_BUFFER_CAPACITY);
        assert!(log.entries.front().unwrap().id > 100);
    }

    #[test]
    fn test_query_with_operation_filter() {
        let mut log = AuditLog {
            entries: VecDeque::new(),
            next_id: 1,
            pending_writes: 0,
        };
        log.add_entry("copy".to_string(), vec!["/a".to_string()], None, true);
        log.add_entry("delete".to_string(), vec!["/b".to_string()], None, true);
        log.add_entry("copy".to_string(), vec!["/c".to_string()], None, false);

        let result = log.query(50, 0, Some("copy"), None, None);
        assert_eq!(result.total, 2);
        assert_eq!(result.entries.len(), 2);
        assert!(result.entries.iter().all(|e| e.operation == "copy"));
    }

    #[test]
    fn test_query_pagination() {
        let mut log = AuditLog {
            entries: VecDeque::new(),
            next_id: 1,
            pending_writes: 0,
        };
        for _ in 0..10 {
            log.add_entry("test".to_string(), vec!["/path".to_string()], None, true);
        }

        let page1 = log.query(3, 0, None, None, None);
        assert_eq!(page1.total, 10);
        assert_eq!(page1.entries.len(), 3);

        let page2 = log.query(3, 3, None, None, None);
        assert_eq!(page2.total, 10);
        assert_eq!(page2.entries.len(), 3);
    }

    #[test]
    fn test_clear_log() {
        let mut log = AuditLog {
            entries: VecDeque::new(),
            next_id: 1,
            pending_writes: 0,
        };
        log.add_entry("test".to_string(), vec!["/a".to_string()], None, true);
        assert!(!log.entries.is_empty());
        log.clear();
        assert!(log.entries.is_empty());
    }

    #[test]
    fn test_export_csv() {
        let mut log = AuditLog {
            entries: VecDeque::new(),
            next_id: 1,
            pending_writes: 0,
        };
        log.add_entry(
            "copy".to_string(),
            vec!["/src/file.txt".to_string(), "/dst/file.txt".to_string()],
            Some("test export".to_string()),
            true,
        );

        let dir = tempfile::tempdir().unwrap();
        let csv_path = dir.path().join("audit.csv");
        let result = log.export_csv(csv_path.to_str().unwrap());
        assert!(result.is_ok());

        let content = fs::read_to_string(&csv_path).unwrap();
        assert!(content.starts_with("id,timestamp,operation,paths,user,details,success\n"));
        assert!(content.contains("copy"));
        assert!(content.contains("/src/file.txt;/dst/file.txt"));
    }

    #[test]
    fn test_whoami_returns_string() {
        let user = whoami();
        assert!(!user.is_empty());
    }

    #[test]
    fn test_query_empty_filter_returns_all() {
        let mut log = AuditLog {
            entries: VecDeque::new(),
            next_id: 1,
            pending_writes: 0,
        };
        log.add_entry("copy".to_string(), vec!["/a".to_string()], None, true);
        log.add_entry("delete".to_string(), vec!["/b".to_string()], None, true);

        let result = log.query(50, 0, Some(""), None, None);
        assert_eq!(result.total, 2);
    }
}
