pub mod commands;
pub mod host_functions;
pub mod manager;
pub mod native_plugin;
pub mod permissions;
pub mod plugin_registry;
pub mod signing;
pub mod types;
pub mod wasm_runtime;

use std::sync::LazyLock;

pub use commands::*;

/// Global WASM runtime instance — DashMap inside provides per-extension locking.
pub static WASM_RUNTIME: LazyLock<wasm_runtime::WasmRuntime> =
    LazyLock::new(wasm_runtime::WasmRuntime::new);
