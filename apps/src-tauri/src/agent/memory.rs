use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};

// ─── Data Structures ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub value: String,
    pub category: String, // "preference", "knowledge", "context"
    pub created_at: u64,
    pub updated_at: u64,
    pub access_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryStore {
    pub entries: HashMap<String, MemoryEntry>,
}

static MEMORY: LazyLock<Arc<Mutex<MemoryStore>>> =
    LazyLock::new(|| Arc::new(Mutex::new(load_memory_from_disk())));

use crate::utils::now_secs;

fn memory_path() -> std::path::PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("xplorer");
    std::fs::create_dir_all(&dir).ok();
    dir.join("agent_memory.json")
}

fn load_memory_from_disk() -> MemoryStore {
    let path = memory_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn save_memory_to_disk(store: &MemoryStore) {
    let path = memory_path();
    if let Ok(json) = serde_json::to_string_pretty(store) {
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, &json).is_ok() {
            if std::fs::rename(&tmp, &path).is_err() {
                let _ = std::fs::remove_file(&tmp);
            }
        }
    }
}

// ─── Tool Executors ─────────────────────────────────────────────────────────

/// Store a memory entry.
pub fn execute_remember(input: &Value) -> Result<String, String> {
    let key = input["key"]
        .as_str()
        .ok_or("Missing 'key' parameter")?
        .to_string();
    let value = input["value"]
        .as_str()
        .ok_or("Missing 'value' parameter")?
        .to_string();
    let category = input["category"]
        .as_str()
        .unwrap_or("knowledge")
        .to_string();

    if !["preference", "knowledge", "context"].contains(&category.as_str()) {
        return Err(format!(
            "Invalid category '{}'. Must be: preference, knowledge, context",
            category
        ));
    }

    let now = now_secs();
    let mut store = MEMORY.lock().unwrap_or_else(|e| e.into_inner());

    let existing = store.entries.get(&key);
    let entry = MemoryEntry {
        key: key.clone(),
        value: value.clone(),
        category: category.clone(),
        created_at: existing.map(|e| e.created_at).unwrap_or(now),
        updated_at: now,
        access_count: existing.map(|e| e.access_count).unwrap_or(0),
    };

    let was_update = store.entries.contains_key(&key);
    store.entries.insert(key.clone(), entry);
    save_memory_to_disk(&store);

    Ok(json!({
        "status": if was_update { "updated" } else { "created" },
        "key": key,
        "category": category,
    })
    .to_string())
}

/// Recall stored memories.
pub fn execute_recall(input: &Value) -> Result<String, String> {
    let category = input["category"].as_str();
    let key = input["key"].as_str();

    let mut store = MEMORY.lock().unwrap_or_else(|e| e.into_inner());

    if let Some(key) = key {
        // Retrieve specific key
        if let Some(entry) = store.entries.get_mut(key) {
            entry.access_count += 1;
            let result = json!({
                "key": entry.key,
                "value": entry.value,
                "category": entry.category,
                "updated_at": entry.updated_at,
            });
            save_memory_to_disk(&store);
            return serde_json::to_string_pretty(&result).map_err(|e| e.to_string());
        }
        return Ok(json!({"message": format!("No memory found for key '{}'", key)}).to_string());
    }

    // Filter by category or return all
    let entries: Vec<Value> = store
        .entries
        .values()
        .filter(|e| category.is_none() || e.category == category.unwrap())
        .map(|e| {
            json!({
                "key": e.key,
                "value": e.value,
                "category": e.category,
                "updated_at": e.updated_at,
            })
        })
        .collect();

    // Bump access count for retrieved entries
    for entry in store.entries.values_mut() {
        if category.is_none() || entry.category == category.unwrap() {
            entry.access_count += 1;
        }
    }
    save_memory_to_disk(&store);

    let output = json!({
        "total": entries.len(),
        "memories": entries,
    });
    serde_json::to_string_pretty(&output).map_err(|e| e.to_string())
}

// ─── Public API (for UI) ───────────────────────────────────────────────────

/// Get all memories for display.
pub fn get_all_memories() -> Vec<MemoryEntry> {
    MEMORY
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .entries
        .values()
        .cloned()
        .collect()
}

/// Clear all memories.
pub fn clear_all_memories() -> Result<(), String> {
    let mut store = MEMORY.lock().unwrap_or_else(|e| e.into_inner());
    store.entries.clear();
    save_memory_to_disk(&store);
    Ok(())
}

/// Delete a specific memory by key.
pub fn delete_memory(key: &str) -> Result<(), String> {
    let mut store = MEMORY.lock().unwrap_or_else(|e| e.into_inner());
    store
        .entries
        .remove(key)
        .ok_or(format!("Memory key '{}' not found", key))?;
    save_memory_to_disk(&store);
    Ok(())
}

/// Build a context string from memories for injection into the system prompt.
pub fn build_memory_context() -> Option<String> {
    let store = MEMORY.lock().unwrap_or_else(|e| e.into_inner());
    if store.entries.is_empty() {
        return None;
    }

    let mut sections = Vec::new();

    // Preferences first
    let prefs: Vec<&MemoryEntry> = store
        .entries
        .values()
        .filter(|e| e.category == "preference")
        .collect();
    if !prefs.is_empty() {
        let mut s = "User Preferences:\n".to_string();
        for p in prefs {
            s.push_str(&format!("- {}: {}\n", p.key, p.value));
        }
        sections.push(s);
    }

    // Knowledge
    let knowledge: Vec<&MemoryEntry> = store
        .entries
        .values()
        .filter(|e| e.category == "knowledge")
        .collect();
    if !knowledge.is_empty() {
        let mut s = "Known Information:\n".to_string();
        for k in knowledge {
            s.push_str(&format!("- {}: {}\n", k.key, k.value));
        }
        sections.push(s);
    }

    // Context
    let context: Vec<&MemoryEntry> = store
        .entries
        .values()
        .filter(|e| e.category == "context")
        .collect();
    if !context.is_empty() {
        let mut s = "Context from previous sessions:\n".to_string();
        for c in context {
            s.push_str(&format!("- {}: {}\n", c.key, c.value));
        }
        sections.push(s);
    }

    Some(sections.join("\n"))
}
