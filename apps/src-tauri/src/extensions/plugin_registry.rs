//! Native Plugin Registry
//!
//! Global registry for loaded native plugins. Provides load, unload, and invoke operations.

use crate::extensions::native_plugin::NativePlugin;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{LazyLock, RwLock};
use tracing::info;

/// Global registry of loaded native plugins, keyed by plugin ID.
static NATIVE_PLUGIN_REGISTRY: LazyLock<RwLock<HashMap<String, NativePlugin>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

/// Determine the platform-specific subdirectory name for native libraries.
fn platform_dir() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "win-x64",
        ("windows", "aarch64") => "win-arm64",
        ("linux", "x86_64") => "linux-x64",
        ("linux", "aarch64") => "linux-arm64",
        ("macos", "x86_64") => "macos-x64",
        ("macos", "aarch64") => "macos-arm64",
        (os, arch) => {
            // Fallback: just use os-arch
            // This is a leak but only happens once per unique platform
            Box::leak(format!("{}-{}", os, arch).into_boxed_str())
        }
    }
}

/// Determine the platform-specific library file extension.
fn lib_extension() -> &'static str {
    match std::env::consts::OS {
        "windows" => "dll",
        "macos" => "dylib",
        _ => "so", // Linux and others
    }
}

/// Determine the platform-specific library file prefix.
fn lib_prefix() -> &'static str {
    match std::env::consts::OS {
        "windows" => "",
        _ => "lib", // Linux and macOS use lib prefix
    }
}

/// Find the native library path within an extension directory.
///
/// Looks for: `<ext_dir>/native/<platform_dir>/<prefix><name>.<ext>`
///
/// Falls back to: `<ext_dir>/native/<prefix><name>.<ext>` (platform-agnostic)
pub fn find_native_library(extension_dir: &str, lib_name: &str) -> Option<String> {
    let ext_dir = Path::new(extension_dir);
    let native_dir = ext_dir.join("native");

    if !native_dir.exists() {
        return None;
    }

    let filename = format!("{}{}.{}", lib_prefix(), lib_name, lib_extension());

    // Try platform-specific path first
    let platform_path = native_dir.join(platform_dir()).join(&filename);
    if platform_path.exists() {
        return Some(platform_path.to_string_lossy().to_string());
    }

    // Fallback to platform-agnostic path
    let generic_path = native_dir.join(&filename);
    if generic_path.exists() {
        return Some(generic_path.to_string_lossy().to_string());
    }

    None
}

/// Load a native plugin from a shared library path and register it.
///
/// Returns the plugin ID on success.
#[allow(dead_code)]
pub fn load_native_plugin(lib_path: &str) -> Result<String, String> {
    let plugin = NativePlugin::load(lib_path)?;
    let plugin_id = plugin.id.clone();

    info!("[NativePlugin] Loaded plugin '{}' ({})", plugin.name, plugin.id);

    let mut registry = NATIVE_PLUGIN_REGISTRY
        .write()
        .map_err(|e| format!("Failed to acquire registry lock: {}", e))?;
    registry.insert(plugin_id.clone(), plugin);

    Ok(plugin_id)
}

/// Unload a native plugin by ID.
///
/// This calls `plugin_shutdown` and drops the library handle.
pub fn unload_native_plugin(plugin_id: &str) -> Result<(), String> {
    let mut registry = NATIVE_PLUGIN_REGISTRY
        .write()
        .map_err(|e| format!("Failed to acquire registry lock: {}", e))?;

    if let Some(plugin) = registry.remove(plugin_id) {
        info!("[NativePlugin] Unloading plugin '{}'", plugin.name);
        // Plugin::drop() calls shutdown automatically
        drop(plugin);
        Ok(())
    } else {
        Err(format!("Native plugin '{}' not found in registry", plugin_id))
    }
}

/// Invoke a command on a loaded native plugin.
pub fn invoke_plugin(
    plugin_id: &str,
    command: &str,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let registry = NATIVE_PLUGIN_REGISTRY
        .read()
        .map_err(|e| format!("Failed to acquire registry lock: {}", e))?;

    let plugin = registry
        .get(plugin_id)
        .ok_or_else(|| format!("Native plugin '{}' not loaded", plugin_id))?;

    plugin.invoke(command, args)
}

/// Check if a plugin is currently loaded.
pub fn is_plugin_loaded(plugin_id: &str) -> bool {
    NATIVE_PLUGIN_REGISTRY
        .read()
        .map(|registry| registry.contains_key(plugin_id))
        .unwrap_or(false)
}

/// Get the IDs of all currently loaded native plugins.
#[allow(dead_code)]
pub fn loaded_plugin_ids() -> Vec<String> {
    NATIVE_PLUGIN_REGISTRY
        .read()
        .map(|registry| registry.keys().cloned().collect())
        .unwrap_or_default()
}
