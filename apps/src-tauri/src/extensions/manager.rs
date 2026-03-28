use crate::extensions::{permissions::*, plugin_registry, signing, types::*};
use serde_json;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{error, warn};

pub struct ExtensionManager {
    pub extensions_dir: PathBuf,
    pub installed_extensions: Vec<ExtensionPackage>,
    pub active_extensions: Vec<String>,
}

impl ExtensionManager {
    pub fn new(extensions_dir: &str) -> Self {
        let extensions_path = PathBuf::from(extensions_dir);
        if !extensions_path.exists() {
            fs::create_dir_all(&extensions_path).unwrap_or_default();
        }

        // Load persisted active extensions
        let active = Self::load_active_extensions_from(&extensions_path);

        let mut manager = ExtensionManager {
            extensions_dir: extensions_path,
            installed_extensions: vec![],
            active_extensions: active,
        };

        // Scan installed extensions on startup
        manager.scan_installed_extensions();
        manager
    }

    pub fn install_extension(&mut self, extension_path: &str) -> Result<ExtensionPackage, String> {
        let manifest_path = Path::new(extension_path).join("package.json");
        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;

        let manifest = super::types::parse_manifest_from_package_json(&manifest_content)?;

        // Validate extension
        self.validate_extension(extension_path, &manifest)?;

        // SECURITY: Double-check extension ID is safe for path construction (defense in depth).
        // validate_extension already checks this, but since join(&manifest.id) is the critical
        // path traversal vector, we validate again here.
        Self::validate_extension_id(&manifest.id)?;

        // Remove existing if upgrading
        if let Some(idx) = self
            .installed_extensions
            .iter()
            .position(|e| e.manifest.id == manifest.id)
        {
            self.installed_extensions.remove(idx);
        }

        // Copy to extensions directory
        let target_path = self.extensions_dir.join(&manifest.id);

        // SECURITY: Verify the target path is still within the extensions directory
        // after the join. This is a final safety net against path traversal.
        // We use lexical component normalization since the target doesn't exist yet
        // and canonicalize() requires the path to exist.
        {
            let canonical_extensions_dir = fs::canonicalize(&self.extensions_dir)
                .map_err(|e| format!("Failed to canonicalize extensions dir: {}", e))?;
            // Normalize the target path lexically to resolve any ".." or "." components
            let mut normalized_target = std::path::PathBuf::new();
            for component in canonical_extensions_dir.join(&manifest.id).components() {
                match component {
                    std::path::Component::ParentDir => {
                        normalized_target.pop();
                    }
                    std::path::Component::CurDir => {}
                    c => normalized_target.push(c.as_os_str()),
                }
            }
            if !normalized_target.starts_with(&canonical_extensions_dir) {
                return Err(format!(
                    "Extension ID '{}' would install outside the extensions directory",
                    manifest.id
                ));
            }
        }
        if target_path.exists() {
            fs::remove_dir_all(&target_path)
                .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
        }

        self.copy_dir_all(Path::new(extension_path), &target_path)?;

        // Verify extension signature after copying to the install location
        let verified = signing::verify_extension_integrity(&target_path, &manifest.id);

        // Detect backend.wasm
        let has_wasm_backend = target_path.join("backend.wasm").exists();

        let extension_package = ExtensionPackage {
            manifest,
            path: target_path.to_string_lossy().to_string(),
            is_active: false,
            is_installed: true,
            verified,
            has_wasm_backend,
            is_dev: false,
        };

        let result = extension_package.clone();
        self.installed_extensions.push(extension_package);
        Ok(result)
    }

    pub fn uninstall_extension(&mut self, extension_id: &str) -> Result<(), String> {
        // First deactivate if active
        self.deactivate_extension(extension_id)?;

        // Remove from installed extensions
        if let Some(index) = self
            .installed_extensions
            .iter()
            .position(|e| e.manifest.id == extension_id)
        {
            let extension = &self.installed_extensions[index];
            let extension_path = Path::new(&extension.path);

            // Remove the extension directory
            if extension_path.exists() {
                fs::remove_dir_all(extension_path)
                    .map_err(|e| format!("Failed to remove extension directory: {}", e))?;
            }

            self.installed_extensions.remove(index);
            Ok(())
        } else {
            Err(format!("Extension '{}' not found", extension_id))
        }
    }

    pub fn activate_extension(&mut self, extension_id: &str) -> Result<(), String> {
        if !self
            .installed_extensions
            .iter()
            .any(|e| e.manifest.id == extension_id)
        {
            return Err(format!("Extension '{}' not installed", extension_id));
        }

        if let Some(ext) = self
            .installed_extensions
            .iter()
            .find(|e| e.manifest.id == extension_id)
        {
            if !ext.verified {
                let ext_path = Path::new(&ext.path);
                let is_builtin = !ext_path.starts_with(&self.extensions_dir);
                if !is_builtin && !ext.is_dev {
                    return Err(format!(
                        "Extension '{}' failed signature verification and cannot be activated. \
                         Re-install from a trusted source.",
                        extension_id
                    ));
                }
                if ext.is_dev {
                    warn!(
                        "[ExtensionManager] Activating UNVERIFIED dev extension '{}'",
                        extension_id
                    );
                } else {
                    warn!(
                        "[ExtensionManager] Activating UNVERIFIED built-in extension '{}'",
                        extension_id
                    );
                }
            }
        }

        if !self.active_extensions.contains(&extension_id.to_string()) {
            // SECURITY: Check for native plugin but do NOT load it (CRIT-04)
            if let Some(ext) = self
                .installed_extensions
                .iter()
                .find(|e| e.manifest.id == extension_id)
            {
                self.try_load_native_plugin(&ext.path, extension_id);
            }

            self.active_extensions.push(extension_id.to_string());

            if let Some(ext) = self
                .installed_extensions
                .iter_mut()
                .find(|e| e.manifest.id == extension_id)
            {
                ext.is_active = true;
            }

            self.save_active_extensions();
        }

        Ok(())
    }

    pub fn deactivate_extension(&mut self, extension_id: &str) -> Result<(), String> {
        if let Some(index) = self
            .active_extensions
            .iter()
            .position(|id| id == extension_id)
        {
            // Unload native plugin if loaded
            if plugin_registry::is_plugin_loaded(extension_id) {
                if let Err(e) = plugin_registry::unload_native_plugin(extension_id) {
                    warn!(
                        "[ExtensionManager] Failed to unload native plugin for '{}': {}",
                        extension_id, e
                    );
                }
            }

            self.active_extensions.remove(index);

            if let Some(ext) = self
                .installed_extensions
                .iter_mut()
                .find(|e| e.manifest.id == extension_id)
            {
                ext.is_active = false;
            }

            self.save_active_extensions();
        }
        Ok(())
    }

    pub fn get_extension_permissions(&self, extension_id: &str) -> Result<Vec<String>, String> {
        if let Some(extension) = self
            .installed_extensions
            .iter()
            .find(|e| e.manifest.id == extension_id)
        {
            Ok(extension.manifest.permissions.clone().unwrap_or_default())
        } else {
            Err(format!("Extension '{}' not found", extension_id))
        }
    }

    /// Try to load a native plugin from the extension's `native/` directory.
    ///
    /// SECURITY: Native plugin loading is currently disabled until code signing
    /// and verification is implemented. Loading arbitrary shared libraries (.dll/.so/.dylib)
    /// allows full system access and arbitrary code execution outside any sandbox.
    /// See audit finding CRIT-04.
    fn try_load_native_plugin(&self, extension_path: &str, extension_id: &str) {
        // Check if a native directory exists and warn, but do NOT load
        let native_dir = std::path::Path::new(extension_path).join("native");
        if native_dir.exists() {
            error!(
                "[ExtensionManager] SECURITY: Native plugin loading is disabled for extension '{}'. \
                 Extension signing and verification must be implemented before native plugins can be loaded. \
                 The native/ directory at '{}' was ignored.",
                extension_id,
                native_dir.display()
            );
            return;
        }

        if plugin_registry::find_native_library(extension_path, extension_id).is_some() {
            error!(
                "[ExtensionManager] SECURITY: Refusing to load native plugin for '{}'. \
                 Native plugin loading is disabled until code signing is implemented.",
                extension_id
            );
        }
    }

    fn scan_installed_extensions(&mut self) {
        self.installed_extensions.clear();

        let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        let active = self.active_extensions.clone();

        // In dev mode, load from local workspace first (takes priority)
        #[cfg(debug_assertions)]
        {
            let workspace_ext_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/extensions");
            if workspace_ext_dir.exists() {
                Self::scan_extension_dir_into(
                    &workspace_ext_dir, true, &active,
                    &mut self.installed_extensions, &mut seen_ids,
                );
            }
        }

        // Then scan the user data extensions dir (marketplace installs)
        if self.extensions_dir.exists() {
            Self::scan_extension_dir_into(
                &self.extensions_dir, false, &active,
                &mut self.installed_extensions, &mut seen_ids,
            );
        }
    }

    fn scan_extension_dir_into(
        dir: &std::path::Path,
        is_dev: bool,
        active: &[String],
        out: &mut Vec<ExtensionPackage>,
        seen_ids: &mut std::collections::HashSet<String>,
    ) {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("package.json");
            if !manifest_path.exists() {
                continue;
            }

            let manifest_content = match fs::read_to_string(&manifest_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let manifest = match super::types::parse_manifest_from_package_json(&manifest_content) {
                Ok(m) => m,
                Err(_) => continue,
            };

            if seen_ids.contains(&manifest.id) {
                continue;
            }
            seen_ids.insert(manifest.id.clone());

            let is_active = active.contains(&manifest.id);
            let verified = signing::verify_extension_integrity(&path, &manifest.id);
            let has_wasm_backend = path.join("backend.wasm").exists();

            out.push(ExtensionPackage {
                manifest,
                path: path.to_string_lossy().to_string(),
                is_active,
                is_installed: true,
                verified,
                has_wasm_backend,
                is_dev,
            });
        }
    }

    // ─── Active Extension Persistence ──────────────────────────────────────

    fn active_extensions_path(&self) -> PathBuf {
        self.extensions_dir.join("active_extensions.json")
    }

    fn load_active_extensions_from(extensions_dir: &Path) -> Vec<String> {
        let path = extensions_dir.join("active_extensions.json");
        if !path.exists() {
            return vec![];
        }
        match fs::read_to_string(&path) {
            Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
            Err(_) => vec![],
        }
    }

    fn save_active_extensions(&self) {
        let path = self.active_extensions_path();
        if let Ok(data) = serde_json::to_string_pretty(&self.active_extensions) {
            let _ = fs::write(&path, data);
        }
    }

    // ─── Validation ───────────────────────────────────────────────────────

    /// Validate an extension ID contains only safe characters (alphanumeric, hyphens, dots, underscores).
    /// This prevents path traversal via crafted extension IDs like "../../etc".
    fn validate_extension_id(id: &str) -> Result<(), String> {
        if id.is_empty() {
            return Err("Extension ID must not be empty".to_string());
        }
        if id.len() > 128 {
            return Err("Extension ID must not exceed 128 characters".to_string());
        }
        // Only allow safe characters: alphanumeric, hyphens, dots (but not leading dot), underscores
        if !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        {
            return Err(format!(
                "Extension ID '{}' contains invalid characters. Only alphanumeric, hyphens, underscores, and dots are allowed.",
                id
            ));
        }
        // Block leading dot (hidden dirs), consecutive dots (..), and path separators
        if id.starts_with('.') || id.contains("..") || id.contains('/') || id.contains('\\') {
            return Err(format!(
                "Extension ID '{}' contains dangerous path sequences",
                id
            ));
        }
        Ok(())
    }

    fn validate_extension(
        &self,
        extension_path: &str,
        manifest: &ExtensionManifest,
    ) -> Result<(), String> {
        if manifest.id.is_empty() || manifest.name.is_empty() || manifest.version.is_empty() {
            return Err(
                "Invalid manifest: missing required fields (id, name, version)".to_string(),
            );
        }

        // SECURITY: Validate extension ID format to prevent path traversal
        Self::validate_extension_id(&manifest.id)?;

        // Validate that the main entry point is specified
        match &manifest.main {
            None => return Err("Invalid manifest: missing 'main' entry point".to_string()),
            Some(main) if main.is_empty() => {
                return Err("Invalid manifest: 'main' entry point is empty".to_string())
            }
            Some(main) => {
                // SECURITY: Validate main entry point does not contain path traversal
                if main.contains("..")
                    || main.starts_with('/')
                    || main.starts_with('\\')
                    || main.contains('\0')
                {
                    return Err(format!(
                        "Invalid manifest: main entry point '{}' contains path traversal",
                        main
                    ));
                }
                // Verify the main file actually exists in the extension directory
                let main_path = Path::new(extension_path).join(main);
                if !main_path.exists() {
                    return Err(format!(
                        "Invalid manifest: main entry point '{}' not found",
                        main
                    ));
                }
            }
        }

        if let Some(permissions) = &manifest.permissions {
            for perm_str in permissions {
                if ExtensionPermission::from_string(perm_str).is_none() {
                    tracing::warn!("[ExtensionManager] Unknown permission '{}' in {} — ignoring", perm_str, manifest.id);
                }
            }
        }

        let extension_dir = Path::new(extension_path);
        self.scan_directory(extension_dir)?;

        Ok(())
    }

    fn scan_directory(&self, dir: &Path) -> Result<(), String> {
        if let Some(name) = dir.file_name().and_then(|n| n.to_str()) {
            // Skip directories that are not part of the extension's distribution
            match name {
                "native" | "node_modules" | ".git" | "src" | ".github" | "target" => return Ok(()),
                _ => {}
            }
        }

        for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            if path.is_dir() {
                self.scan_directory(&path)?;
            } else if let Some(ext) = path.extension() {
                match ext.to_str() {
                    Some("js") | Some("ts") => self.scan_javascript_file(&path)?,
                    Some("json") => {
                        if path.file_name().unwrap_or_default().to_str() == Some("package.json") {
                            continue;
                        }
                        self.scan_json_file(&path)?;
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    fn scan_javascript_file(&self, file_path: &Path) -> Result<(), String> {
        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;

        // These patterns indicate code that attempts to break out of the extension sandbox.
        // Extensions should use the Xplorer Extension SDK APIs (api.files, api.ui, etc.) instead.
        let dangerous_patterns: &[(&str, &str)] = &[
            ("require(\"child_process\")", "Use api.nativeInvoke() with a native plugin instead of child_process"),
            ("require('child_process')",   "Use api.nativeInvoke() with a native plugin instead of child_process"),
            ("process.exit",               "Extensions must not call process.exit — return normally from deactivate()"),
            ("fs.unlinkSync",              "Use api.files.write() / api.files via the Extension SDK instead of direct fs calls"),
            ("fs.rmdirSync",               "Use api.files via the Extension SDK instead of direct fs calls"),
            ("fs.writeFileSync",           "Use api.files.write() from the Extension SDK instead of direct fs writes"),
        ];

        for (pattern, suggestion) in dangerous_patterns {
            if content.contains(pattern) {
                return Err(format!(
                    "Blocked: {} in {}\nHint: {}",
                    pattern,
                    file_path.display(),
                    suggestion
                ));
            }
        }

        Ok(())
    }

    fn scan_json_file(&self, file_path: &Path) -> Result<(), String> {
        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;

        serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("Invalid JSON in {}: {}", file_path.display(), e))?;

        Ok(())
    }

    fn copy_dir_all(&self, src: &Path, dst: &Path) -> Result<(), String> {
        fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory: {}", e))?;

        // SECURITY: Canonicalize src to get the real path, then verify all entries
        // stay within it. This prevents symlink-based escapes during installation.
        let canonical_src = fs::canonicalize(src)
            .map_err(|e| format!("Failed to canonicalize source directory: {}", e))?;

        for entry in
            fs::read_dir(src).map_err(|e| format!("Failed to read source directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            // SECURITY: Check if the entry is a symlink and skip it.
            // Symlinks in extension packages could point outside the extension directory,
            // allowing exfiltration of sensitive files during installation.
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to get file type: {}", e))?;
            if file_type.is_symlink() {
                warn!(
                    "[ExtensionManager] Skipping symlink during installation: {}",
                    src_path.display()
                );
                continue;
            }

            // SECURITY: Verify the real path of the entry is within the source directory.
            // This catches symlinks that were followed via parent directory resolution.
            if let Ok(canonical_entry) = fs::canonicalize(&src_path) {
                if !canonical_entry.starts_with(&canonical_src) {
                    warn!(
                        "[ExtensionManager] Skipping entry outside source directory: {}",
                        src_path.display()
                    );
                    continue;
                }
            }

            if src_path.is_dir() {
                self.copy_dir_all(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
            }
        }
        Ok(())
    }
}
