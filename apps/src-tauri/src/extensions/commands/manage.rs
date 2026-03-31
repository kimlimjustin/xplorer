use crate::extensions::{plugin_registry, types::*};
use tauri::command;

use super::{validate_extension_id, EXTENSION_MANAGER};

#[command]
pub async fn get_installed_extensions() -> Result<Vec<ExtensionPackage>, String> {
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.installed_extensions.clone())
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn activate_extension(extension_id: String) -> Result<(), String> {
    validate_extension_id(&extension_id)?;
    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.activate_extension(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn deactivate_extension(extension_id: String) -> Result<(), String> {
    validate_extension_id(&extension_id)?;

    // Unload WASM instance if loaded.
    crate::extensions::WASM_RUNTIME.unload(&extension_id);

    let mut manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_mut() {
        manager.deactivate_extension(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn get_extension_permissions(extension_id: String) -> Result<Vec<String>, String> {
    validate_extension_id(&extension_id)?;
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        manager.get_extension_permissions(&extension_id)
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn get_active_extension_ids() -> Result<Vec<String>, String> {
    let manager_guard = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.active_extensions.clone())
    } else {
        Err("Extension manager not initialized".to_string())
    }
}

#[command]
pub async fn validate_extension_path(extension_path: String) -> Result<ExtensionManifest, String> {
    use std::fs;
    use std::path::Path;

    let manifest_path = Path::new(&extension_path).join("package.json");
    if !manifest_path.exists() {
        return Err("Extension manifest (package.json) not found".to_string());
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest = crate::extensions::types::parse_manifest_from_package_json(&manifest_content)?;

    if manifest.id.is_empty() || manifest.name.is_empty() || manifest.version.is_empty() {
        return Err("Invalid manifest: missing required fields".to_string());
    }

    Ok(manifest)
}

/// Invoke a command on a loaded native extension plugin.
///
/// This allows extensions with compiled shared libraries to expose
/// backend functionality (e.g., SSH, FTP) through a JSON-based command interface.
///
/// The calling extension must either own the plugin (extension_id == plugin_id)
/// or have the `native:invoke` permission granted.
#[command]
pub async fn native_plugin_invoke(
    extension_id: String,
    plugin_id: String,
    command: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    validate_extension_id(&extension_id)?;
    validate_extension_id(&plugin_id)?;

    // Verify the calling extension is active and has appropriate permissions.
    {
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

        // The extension must either own the plugin or have native:invoke permission.
        let permissions = ext.manifest.permissions.clone().unwrap_or_default();
        if extension_id != plugin_id && !permissions.iter().any(|p| p == "native:invoke") {
            return Err(format!(
                "Extension '{}' lacks 'native:invoke' permission to invoke plugin '{}'",
                extension_id, plugin_id
            ));
        }
    }
    // Manager lock released here.

    // Run in blocking thread since native plugin calls may block
    tokio::task::spawn_blocking(move || plugin_registry::invoke_plugin(&plugin_id, &command, args))
        .await
        .map_err(|e| format!("Plugin invocation failed: {}", e))?
}
