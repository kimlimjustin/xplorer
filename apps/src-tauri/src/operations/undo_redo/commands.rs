use tauri::command;

use super::{
    extract_paths, execute_redo, execute_undo, FileOperation, UndoHistoryEntry,
    UndoHistorySnapshot, UndoRedoResult, MAX_HISTORY, OPERATION_HISTORY,
};

#[command]
pub async fn undo_operation() -> Result<UndoRedoResult, String> {
    let ts_op = {
        let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
        history.pop_undo()
    };

    match ts_op {
        None => Ok(UndoRedoResult {
            success: false,
            message: "Nothing to undo".to_string(),
            operation_type: "none".to_string(),
        }),
        Some(ts_op) => {
            let description = ts_op.op.describe();
            let op_type = match &ts_op.op {
                FileOperation::Copy { .. } => "copy",
                FileOperation::Move { .. } => "move",
                FileOperation::Delete { .. } => "delete",
                FileOperation::Rename { .. } => "rename",
            }
            .to_string();

            match execute_undo(&ts_op.op) {
                Ok(()) => {
                    // Push to redo stack
                    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
                    history.push_redo(ts_op);
                    Ok(UndoRedoResult {
                        success: true,
                        message: format!("Undone: {}", description),
                        operation_type: op_type,
                    })
                }
                Err(e) => {
                    // Put the operation back since undo failed
                    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
                    history.undo_stack.push(ts_op);
                    Err(format!("Failed to undo: {}", e))
                }
            }
        }
    }
}

#[command]
pub async fn redo_operation() -> Result<UndoRedoResult, String> {
    let ts_op = {
        let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
        history.pop_redo()
    };

    match ts_op {
        None => Ok(UndoRedoResult {
            success: false,
            message: "Nothing to redo".to_string(),
            operation_type: "none".to_string(),
        }),
        Some(ts_op) => {
            let description = ts_op.op.describe_redo();
            let op_type = match &ts_op.op {
                FileOperation::Copy { .. } => "copy",
                FileOperation::Move { .. } => "move",
                FileOperation::Delete { .. } => "delete",
                FileOperation::Rename { .. } => "rename",
            }
            .to_string();

            match execute_redo(&ts_op.op) {
                Ok(()) => {
                    // Push back to undo stack (without clearing redo — only new ops clear redo)
                    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
                    history.undo_stack.push(ts_op);
                    if history.undo_stack.len() > MAX_HISTORY {
                        history.undo_stack.remove(0);
                    }
                    Ok(UndoRedoResult {
                        success: true,
                        message: format!("Redone: {}", description),
                        operation_type: op_type,
                    })
                }
                Err(e) => {
                    // Put the operation back since redo failed
                    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
                    history.redo_stack.push(ts_op);
                    Err(format!("Failed to redo: {}", e))
                }
            }
        }
    }
}

#[command]
pub async fn get_undo_history() -> Result<UndoHistorySnapshot, String> {
    let history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());

    let mut entries = Vec::new();
    let mut idx = 0usize;

    // Undo stack entries (oldest first — index 0 is the first operation performed)
    for ts_op in history.undo_stack.iter() {
        let (source_path, dest_path) = extract_paths(&ts_op.op);
        entries.push(UndoHistoryEntry {
            index: idx,
            operation_type: ts_op.op.type_label().to_string(),
            description: ts_op.op.describe_forward(),
            undoable: true,
            timestamp_ms: ts_op.timestamp_ms,
            source_path,
            dest_path,
        });
        idx += 1;
    }

    let undo_count = idx;

    // Redo stack entries (the most-recently-undone operation is at the top of the redo stack,
    // so iterate in reverse to present them in chronological order)
    for ts_op in history.redo_stack.iter().rev() {
        let (source_path, dest_path) = extract_paths(&ts_op.op);
        entries.push(UndoHistoryEntry {
            index: idx,
            operation_type: ts_op.op.type_label().to_string(),
            description: ts_op.op.describe_forward(),
            undoable: false,
            timestamp_ms: ts_op.timestamp_ms,
            source_path,
            dest_path,
        });
        idx += 1;
    }

    Ok(UndoHistorySnapshot {
        entries,
        undo_count,
    })
}

#[command]
pub async fn clear_undo_history() -> Result<(), String> {
    let mut history = OPERATION_HISTORY.lock().unwrap_or_else(|e| e.into_inner());
    history.undo_stack.clear();
    history.redo_stack.clear();
    Ok(())
}
