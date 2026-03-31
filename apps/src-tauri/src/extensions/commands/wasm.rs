use serde::{Deserialize, Serialize};
use tauri::command;

use super::{validate_extension_id, EXTENSION_MANAGER};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmBackendStatus {
    pub loaded: bool,
    pub has_wasm_file: bool,
    pub extension_id: String,
}

/// Call a method on an extension's WASM backend.
///
/// If the WASM module isn't loaded yet, it will be loaded on-demand from
/// the extension's `backend.wasm` file.
#[command]
pub async fn extension_backend_call(
    extension_id: String,
    method: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_extension_id(&extension_id)?;

    let args_json =
        serde_json::to_string(&args).map_err(|e| format!("Failed to serialize args: {}", e))?;

    // Run in a blocking thread since WASM execution is synchronous.
    tokio::task::spawn_blocking(move || {
        // Get extension info (path, permissions) from the extension manager.
        let (ext_path, permissions) = {
            let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
            let manager = manager_guard
                .as_ref()
                .ok_or("Extension manager not initialized")?;
            let ext = manager
                .installed_extensions
                .iter()
                .find(|e| e.manifest.id == extension_id)
                .ok_or_else(|| format!("Extension '{}' not found", extension_id))?;
            if !ext.is_active {
                return Err(format!("Extension '{}' is not active", extension_id));
            }
            (
                ext.path.clone(),
                ext.manifest.permissions.clone().unwrap_or_default(),
            )
        };
        // Manager lock released here.

        let runtime = &crate::extensions::WASM_RUNTIME;

        // Load on demand if not already loaded.
        if !runtime.is_loaded(&extension_id) {
            let wasm_path = std::path::Path::new(&ext_path).join("backend.wasm");
            if !wasm_path.exists() {
                return Err(format!(
                    "Extension '{}' has no backend.wasm file",
                    extension_id
                ));
            }
            let wasm_bytes = std::fs::read(&wasm_path)
                .map_err(|e| format!("Failed to read backend.wasm: {}", e))?;
            runtime.load_module(&extension_id, &wasm_bytes, permissions)?;
        }

        let result_json = runtime.call(&extension_id, &method, &args_json)?;

        serde_json::from_str::<serde_json::Value>(&result_json)
            .map_err(|e| format!("WASM returned invalid JSON: {}", e))
    })
    .await
    .map_err(|e| format!("WASM backend call failed: {}", e))?
}

/// Get the status of an extension's WASM backend (loaded, has wasm file, etc.).
#[command]
pub async fn extension_backend_status(extension_id: String) -> Result<WasmBackendStatus, String> {
    validate_extension_id(&extension_id)?;

    let has_wasm_file = {
        let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
        let manager = manager_guard
            .as_ref()
            .ok_or("Extension manager not initialized")?;
        manager
            .installed_extensions
            .iter()
            .find(|e| e.manifest.id == extension_id)
            .map(|e| e.has_wasm_backend)
            .unwrap_or(false)
    };

    let loaded = { crate::extensions::WASM_RUNTIME.is_loaded(&extension_id) };

    Ok(WasmBackendStatus {
        loaded,
        has_wasm_file,
        extension_id,
    })
}
