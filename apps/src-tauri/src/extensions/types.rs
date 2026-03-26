use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    #[serde(alias = "displayName")]
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub category: String, // theme, preview, action, panel, tool
    pub icon: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
    pub permissions: Option<Vec<String>>,
    #[serde(alias = "activationEvents")]
    pub activation_events: Option<Vec<String>>,
    pub main: Option<String>,
    pub contributes: Option<ExtensionContributes>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionContributes {
    pub panels: Option<Vec<PanelContribution>>,
    pub commands: Option<Vec<CommandContribution>>,
    pub themes: Option<Vec<String>>,
    #[serde(alias = "fileTypes")]
    pub file_types: Option<Vec<FileTypeContribution>>,
    #[serde(alias = "contextMenus")]
    pub context_menus: Option<Vec<ContextMenuContribution>>,
    pub keybindings: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelContribution {
    pub id: String,
    pub title: String,
    pub location: String, // "sidebar", "bottom", "right"
    pub icon: Option<String>,
    pub when: Option<String>, // Condition for when to show
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub command: String,
    pub title: String,
    pub category: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTypeContribution {
    pub id: String,
    pub extensions: Vec<String>,
    #[serde(alias = "mimeTypes")]
    pub mime_types: Option<Vec<String>>,
    pub icon: Option<String>,
    #[serde(alias = "languageId")]
    pub language_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuContribution {
    pub command: String,
    pub when: Option<String>,
    pub group: Option<String>,
}

/// Parse an ExtensionManifest from a package.json string.
/// Supports two formats:
/// 1. NPM-style package.json with an `xplorer` key containing manifest fields
/// 2. Flat manifest where all fields are at the top level
pub fn parse_manifest_from_package_json(content: &str) -> Result<ExtensionManifest, String> {
    let raw: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {}", e))?;

    let obj = raw
        .as_object()
        .ok_or_else(|| "package.json must be a JSON object".to_string())?;

    // If there's an `xplorer` key, extract manifest fields from it
    if let Some(xplorer_val) = obj.get("xplorer") {
        let mut manifest_obj = xplorer_val
            .as_object()
            .ok_or_else(|| "xplorer field must be a JSON object".to_string())?
            .clone();

        // Merge top-level `main` into the xplorer object if not already present
        if !manifest_obj.contains_key("main") {
            if let Some(main_val) = obj.get("main") {
                manifest_obj.insert("main".to_string(), main_val.clone());
            }
        }

        // Merge top-level `description` if not present
        if !manifest_obj.contains_key("description") {
            if let Some(desc_val) = obj.get("description") {
                manifest_obj.insert("description".to_string(), desc_val.clone());
            }
        }

        let manifest: ExtensionManifest =
            serde_json::from_value(serde_json::Value::Object(manifest_obj))
                .map_err(|e| format!("Invalid manifest in xplorer field: {}", e))?;
        return Ok(manifest);
    }

    // No xplorer key — try direct deserialization
    let manifest: ExtensionManifest =
        serde_json::from_value(raw).map_err(|e| format!("Invalid manifest JSON: {}", e))?;
    Ok(manifest)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionPackage {
    pub manifest: ExtensionManifest,
    pub path: String,
    pub is_active: bool,
    pub is_installed: bool,
    /// Whether the extension's signature has been verified.
    /// `true` if a valid `.sig` file was found and the hash matches on-disk contents.
    /// `false` if the extension is unsigned, the signature is invalid, or verification failed.
    #[serde(default)]
    pub verified: bool,
    /// Whether the extension has a `backend.wasm` file for WASM backend execution.
    #[serde(default)]
    pub has_wasm_backend: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeData {
    pub name: String,
    pub display_name: Option<String>,
    pub theme_type: String, // "light" or "dark"
    pub colors: HashMap<String, String>,
    pub fonts: Option<HashMap<String, String>>,
    pub spacing: Option<HashMap<String, String>>,
    pub border_radius: Option<HashMap<String, String>>,
    pub shadows: Option<HashMap<String, String>>,
    pub animations: Option<HashMap<String, serde_json::Value>>,
}
