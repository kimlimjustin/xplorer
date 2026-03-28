use dashmap::DashMap;
use std::sync::Mutex;
use tracing::warn;
use wasmi::*;

/// State held by the host and accessible from host functions.
pub struct HostState {
    pub extension_id: String,
    pub permissions: Vec<String>,
    pub memory: Option<Memory>,
    /// Buffer used by host functions to return string results to the guest.
    pub result_buffer: Option<String>,
}

/// A loaded WASM extension instance with its store and exported helpers.
pub struct WasmInstance {
    store: Store<HostState>,
    _instance: Instance,
    /// Guest-exported: `handle_call(method_ptr, method_len, args_ptr, args_len) -> result_ptr`
    handle_call: TypedFunc<(i32, i32, i32, i32), i32>,
    /// Guest-exported: `alloc(size) -> ptr`
    alloc: TypedFunc<i32, i32>,
    /// Guest-exported: `dealloc(ptr, len)`
    dealloc: TypedFunc<(i32, i32), ()>,
}

/// The top-level WASM runtime that owns the engine and all loaded instances.
pub struct WasmRuntime {
    engine: Engine,
    instances: DashMap<String, Mutex<WasmInstance>>,
}

/// Fuel budget for a single `call()` invocation.
const CALL_FUEL_LIMIT: u64 = 1_000_000;

/// Maximum linear memory pages an extension may use (64KB per page).
const MAX_MEMORY_PAGES: u32 = 1024; // 64MB

impl Default for WasmRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl WasmRuntime {
    /// Create a new runtime with fuel-metered engine.
    pub fn new() -> Self {
        let mut config = Config::default();
        config.consume_fuel(true);
        let engine = Engine::new(&config);
        WasmRuntime {
            engine,
            instances: DashMap::new(),
        }
    }

    /// Compile and instantiate a WASM module for the given extension.
    pub fn load_module(
        &self,
        extension_id: &str,
        wasm_bytes: &[u8],
        permissions: Vec<String>,
    ) -> Result<(), String> {
        // Unload any previous instance for this extension.
        self.instances.remove(extension_id);

        let module = Module::new(&self.engine, wasm_bytes)
            .map_err(|e| format!("Failed to compile WASM module: {}", e))?;

        let host_state = HostState {
            extension_id: extension_id.to_string(),
            permissions,
            memory: None,
            result_buffer: None,
        };

        let mut store = Store::new(&self.engine, host_state);
        // Give an initial fuel budget so the start function (if any) can run.
        store
            .set_fuel(CALL_FUEL_LIMIT)
            .map_err(|e| format!("Failed to set fuel: {}", e))?;

        let mut linker = Linker::<HostState>::new(&self.engine);
        super::host_functions::register_host_functions(&mut linker)
            .map_err(|e| format!("Failed to register host functions: {}", e))?;

        let instance = linker
            .instantiate(&mut store, &module)
            .map_err(|e| format!("Failed to instantiate WASM module: {}", e))?
            .start(&mut store)
            .map_err(|e| format!("Failed to start WASM module: {}", e))?;

        // Cache the guest memory export and enforce memory limit.
        if let Some(Extern::Memory(mem)) = instance.get_export(&store, "memory") {
            let current_pages = mem.size(&store);
            if current_pages > MAX_MEMORY_PAGES {
                return Err(format!(
                    "Extension '{}' initial memory ({} pages / {} MB) exceeds limit ({} pages / {} MB)",
                    extension_id,
                    current_pages, current_pages as u64 * 64 / 1024,
                    MAX_MEMORY_PAGES, MAX_MEMORY_PAGES as u64 * 64 / 1024
                ));
            }
            store.data_mut().memory = Some(mem);
        }

        // Resolve required exports.
        let handle_call = instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&store, "handle_call")
            .map_err(|e| format!("Missing or invalid 'handle_call' export: {}", e))?;

        let alloc = instance
            .get_typed_func::<i32, i32>(&store, "alloc")
            .map_err(|e| format!("Missing or invalid 'alloc' export: {}", e))?;

        let dealloc = instance
            .get_typed_func::<(i32, i32), ()>(&store, "dealloc")
            .map_err(|e| format!("Missing or invalid 'dealloc' export: {}", e))?;

        let wasm_instance = WasmInstance {
            store,
            _instance: instance,
            handle_call,
            alloc,
            dealloc,
        };

        self.instances
            .insert(extension_id.to_string(), Mutex::new(wasm_instance));
        Ok(())
    }

    /// Call an extension's backend method, passing method name + JSON args through
    /// linear memory and reading the JSON result back.
    pub fn call(
        &self,
        extension_id: &str,
        method: &str,
        args_json: &str,
    ) -> Result<String, String> {
        let instance_ref = self
            .instances
            .get(extension_id)
            .ok_or_else(|| format!("WASM instance '{}' not loaded", extension_id))?;
        let mut inst = instance_ref.lock().unwrap_or_else(|e| e.into_inner());

        // Copy the TypedFunc handles — they are Copy and do not borrow `inst`.
        let alloc = inst.alloc;
        let dealloc = inst.dealloc;
        let handle_call = inst.handle_call;

        // Reset fuel for this call.
        inst.store
            .set_fuel(CALL_FUEL_LIMIT)
            .map_err(|e| format!("Failed to set fuel: {}", e))?;

        // 1. Write method name into guest memory.
        let method_bytes = method.as_bytes();
        let method_ptr = alloc
            .call(&mut inst.store, method_bytes.len() as i32)
            .map_err(|e| format!("alloc failed for method: {}", e))?;
        write_to_memory(&mut inst.store, method_ptr, method_bytes)?;

        // 2. Write args JSON into guest memory.
        let args_bytes = args_json.as_bytes();
        let args_ptr = alloc
            .call(&mut inst.store, args_bytes.len() as i32)
            .map_err(|e| format!("alloc failed for args: {}", e))?;
        write_to_memory(&mut inst.store, args_ptr, args_bytes)?;

        // 3. Call handle_call.
        let result_ptr = handle_call
            .call(
                &mut inst.store,
                (
                    method_ptr,
                    method_bytes.len() as i32,
                    args_ptr,
                    args_bytes.len() as i32,
                ),
            )
            .map_err(|e| {
                // Check for fuel exhaustion.
                let msg = format!("{}", e);
                if msg.contains("fuel") {
                    format!(
                        "Extension '{}' exceeded CPU budget (fuel exhausted) during '{}'",
                        extension_id, method
                    )
                } else {
                    format!("handle_call trapped: {}", msg)
                }
            })?;

        // 4. Read result from guest memory.
        //    Convention: result_ptr points to a 8-byte header [ptr: i32, len: i32]
        //    followed by the JSON string.
        let result_json = read_result_from_memory(&inst.store, result_ptr)?;

        // 5. Free the method and args allocations.
        let _ = dealloc.call(&mut inst.store, (method_ptr, method_bytes.len() as i32));
        let _ = dealloc.call(&mut inst.store, (args_ptr, args_bytes.len() as i32));

        Ok(result_json)
    }

    /// Unload (drop) an extension's WASM instance.
    pub fn unload(&self, extension_id: &str) {
        if self.instances.remove(extension_id).is_some() {
            warn!(
                "[WasmRuntime] Unloaded WASM instance for '{}'",
                extension_id
            );
        }
    }

    /// Check whether a WASM instance is loaded for the given extension.
    pub fn is_loaded(&self, extension_id: &str) -> bool {
        self.instances.contains_key(extension_id)
    }
}

// ─── Memory helpers ──────────────────────────────────────────────────────────

/// Write `data` into the guest's linear memory starting at `ptr`.
/// Accepts anything that implements `AsContextMut` (Store, Caller, etc.).
fn write_to_memory(
    ctx: &mut impl AsContextMut<Data = HostState>,
    ptr: i32,
    data: &[u8],
) -> Result<(), String> {
    let memory = ctx
        .as_context()
        .data()
        .memory
        .ok_or_else(|| "Guest has no exported memory".to_string())?;
    let start = ptr as usize;
    let end = start + data.len();
    let mem_len = memory.data(ctx.as_context()).len();
    if end > mem_len {
        return Err(format!(
            "Write out of bounds: offset {}..{} but memory size is {}",
            start, end, mem_len
        ));
    }
    memory
        .data_mut(ctx.as_context_mut())
        .get_mut(start..end)
        .ok_or_else(|| "Failed to get mutable memory slice".to_string())?
        .copy_from_slice(data);
    Ok(())
}

/// Read a length-prefixed result string from guest memory.
///
/// The guest writes the result as:
///   [result_len: i32 LE][result bytes...]
///
/// `result_ptr` points to the 4-byte length prefix.
fn read_result_from_memory(
    ctx: &impl AsContext<Data = HostState>,
    result_ptr: i32,
) -> Result<String, String> {
    let memory = ctx
        .as_context()
        .data()
        .memory
        .ok_or_else(|| "Guest has no exported memory".to_string())?;
    let mem_data = memory.data(ctx.as_context());
    let header_start = result_ptr as usize;

    // Read the 4-byte length prefix.
    if header_start + 4 > mem_data.len() {
        return Err("Result pointer out of bounds (header)".to_string());
    }
    let len_bytes: [u8; 4] = mem_data[header_start..header_start + 4]
        .try_into()
        .map_err(|_| "Failed to read result length".to_string())?;
    let result_len = i32::from_le_bytes(len_bytes) as usize;

    if result_len == 0 {
        return Ok("null".to_string());
    }

    // Read the result string.
    let data_start = header_start + 4;
    let data_end = data_start + result_len;
    if data_end > mem_data.len() {
        return Err(format!(
            "Result data out of bounds: {}..{} but memory size is {}",
            data_start,
            data_end,
            mem_data.len()
        ));
    }

    String::from_utf8(mem_data[data_start..data_end].to_vec())
        .map_err(|e| format!("Result is not valid UTF-8: {}", e))
}

/// Read a UTF-8 string from guest memory at `(ptr, len)`.
/// Accepts anything that implements `AsContext` (Store, Caller, etc.).
pub fn read_string_from_memory(
    ctx: &impl AsContext<Data = HostState>,
    ptr: i32,
    len: i32,
) -> Result<String, String> {
    let memory = ctx
        .as_context()
        .data()
        .memory
        .ok_or_else(|| "Guest has no exported memory".to_string())?;
    let mem_data = memory.data(ctx.as_context());
    let start = ptr as usize;
    let end = start + len as usize;
    if end > mem_data.len() {
        return Err(format!(
            "Read out of bounds: offset {}..{} but memory size is {}",
            start,
            end,
            mem_data.len()
        ));
    }
    String::from_utf8(mem_data[start..end].to_vec())
        .map_err(|e| format!("Memory region is not valid UTF-8: {}", e))
}
