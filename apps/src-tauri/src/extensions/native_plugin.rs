//! Native Plugin ABI
//!
//! Defines the C-compatible ABI that native extension plugins must implement.
//! Plugins are compiled as shared libraries (.dll/.so/.dylib) and loaded at runtime.
//!
//! ## Plugin Contract
//!
//! A native plugin must export these C functions:
//! - `plugin_init() -> *const c_char` — Returns JSON metadata, initializes the plugin
//! - `plugin_invoke(command, args_json) -> *mut c_char` — Executes a command, returns JSON result
//! - `plugin_free(ptr)` — Frees a string returned by `plugin_invoke`
//! - `plugin_shutdown()` — Cleans up plugin resources

use std::ffi::{CStr, CString, c_char};

/// Function signatures that plugins must export
#[allow(dead_code)]
pub type PluginInitFn = unsafe extern "C" fn() -> *const c_char;
pub type PluginInvokeFn = unsafe extern "C" fn(*const c_char, *const c_char) -> *mut c_char;
pub type PluginFreeFn = unsafe extern "C" fn(*mut c_char);
pub type PluginShutdownFn = unsafe extern "C" fn();

/// Host-side wrapper around a loaded native plugin shared library.
#[allow(dead_code)]
pub struct NativePlugin {
    /// Holds the library handle to prevent it from being dropped (which would unload the library).
    _lib: libloading::Library,
    /// Plugin identifier (from metadata).
    pub id: String,
    /// Human-readable plugin name.
    pub name: String,
    /// Cached function pointer for invoking commands.
    invoke_fn: PluginInvokeFn,
    /// Cached function pointer for freeing returned strings.
    free_fn: PluginFreeFn,
    /// Cached function pointer for shutdown.
    shutdown_fn: PluginShutdownFn,
}

// Safety: The shared library functions are extern "C" and the plugin manages its own
// thread safety internally (e.g., via its own tokio runtime and Arc/RwLock).
unsafe impl Send for NativePlugin {}
unsafe impl Sync for NativePlugin {}

impl NativePlugin {
    /// Load a native plugin from the given shared library path.
    ///
    /// This will:
    /// 1. Load the shared library
    /// 2. Resolve all required symbols
    /// 3. Call `plugin_init` to get metadata and initialize the plugin
    /// 4. Return a `NativePlugin` wrapper
    #[allow(dead_code, unused_variables)]
    pub fn load(lib_path: &str) -> Result<Self, String> {
        // SECURITY (CRIT-04): Native plugin loading is disabled until code signing is implemented.
        // Unsigned native plugins can execute arbitrary code at full process privilege.
        return Err(
            "Native plugin loading is currently disabled for security. \
             Extension code signing must be implemented before native plugins can be loaded."
                .into(),
        );

        // Safety: we trust that the library implements the plugin ABI correctly.
        // This is the nature of dynamic library loading.
        #[allow(unreachable_code)]
        unsafe {
            let lib = libloading::Library::new(lib_path)
                .map_err(|e| format!("Failed to load native plugin library '{}': {}", lib_path, e))?;

            let init_fn: libloading::Symbol<PluginInitFn> = lib.get(b"plugin_init")
                .map_err(|e| format!("Missing 'plugin_init' symbol: {}", e))?;
            let invoke_fn: libloading::Symbol<PluginInvokeFn> = lib.get(b"plugin_invoke")
                .map_err(|e| format!("Missing 'plugin_invoke' symbol: {}", e))?;
            let free_fn: libloading::Symbol<PluginFreeFn> = lib.get(b"plugin_free")
                .map_err(|e| format!("Missing 'plugin_free' symbol: {}", e))?;
            let shutdown_fn: libloading::Symbol<PluginShutdownFn> = lib.get(b"plugin_shutdown")
                .map_err(|e| format!("Missing 'plugin_shutdown' symbol: {}", e))?;

            // Cache the raw function pointers before the symbols are dropped
            let invoke_fn_raw = *invoke_fn;
            let free_fn_raw = *free_fn;
            let shutdown_fn_raw = *shutdown_fn;

            // Call plugin_init to get metadata JSON
            let info_ptr = init_fn();
            if info_ptr.is_null() {
                return Err("plugin_init returned null".to_string());
            }
            let info_str = CStr::from_ptr(info_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8 from plugin_init: {}", e))?;

            let info: serde_json::Value = serde_json::from_str(info_str)
                .map_err(|e| format!("Invalid JSON from plugin_init: {}", e))?;

            let id = info["id"].as_str()
                .ok_or("Plugin metadata missing 'id' field")?
                .to_string();
            let name = info["name"].as_str()
                .unwrap_or(&id)
                .to_string();

            Ok(NativePlugin {
                _lib: lib,
                id,
                name,
                invoke_fn: invoke_fn_raw,
                free_fn: free_fn_raw,
                shutdown_fn: shutdown_fn_raw,
            })
        }
    }

    /// Invoke a command on this plugin.
    ///
    /// Serializes args to JSON, calls the plugin's `plugin_invoke`, reads the result,
    /// frees the returned string, and deserializes the JSON result.
    pub fn invoke(&self, command: &str, args: serde_json::Value) -> Result<serde_json::Value, String> {
        let cmd = CString::new(command)
            .map_err(|e| format!("Invalid command string: {}", e))?;
        let args_json = CString::new(serde_json::to_string(&args).map_err(|e| e.to_string())?)
            .map_err(|e| format!("Failed to create args CString: {}", e))?;

        unsafe {
            let result_ptr = (self.invoke_fn)(cmd.as_ptr(), args_json.as_ptr());
            if result_ptr.is_null() {
                return Err("Plugin returned null".to_string());
            }

            let result_str = CStr::from_ptr(result_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8 from plugin: {}", e))?
                .to_string();

            // Free the string allocated by the plugin
            (self.free_fn)(result_ptr);

            // Check if the result is an error
            let value: serde_json::Value = serde_json::from_str(&result_str)
                .map_err(|e| format!("Invalid JSON from plugin: {}", e))?;

            if let Some(err) = value.get("error").and_then(|e| e.as_str()) {
                Err(err.to_string())
            } else {
                Ok(value)
            }
        }
    }

    /// Shutdown the plugin, releasing all resources.
    pub fn shutdown(&self) {
        unsafe {
            (self.shutdown_fn)();
        }
    }
}

impl Drop for NativePlugin {
    fn drop(&mut self) {
        self.shutdown();
    }
}
