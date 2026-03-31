use crate::shortcuts::types::*;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use tauri::command;

static SHORTCUTS_MANAGER: LazyLock<Mutex<Option<ShortcutsManager>>> =
    LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Clone)]
pub struct ShortcutsManager {
    pub settings: ShortcutSettings,
    pub current_profile_id: String,
    data_dir: PathBuf,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ShortcutKeyInput {
    pub key: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
}

/// Helper to build a ShortcutBinding concisely.
fn sb(
    id: &str,
    keys: &[&str],
    action: ShortcutAction,
    context: Option<String>,
    profile: &str,
    description: &str,
    key_combination: &str,
) -> ShortcutBinding {
    ShortcutBinding {
        id: id.to_string(),
        keys: keys.iter().map(|k| k.to_string()).collect(),
        action,
        context,
        enabled: true,
        profile: profile.to_string(),
        description: Some(description.to_string()),
        global: false,
        key_combination: key_combination.to_string(),
    }
}

impl ShortcutsManager {
    pub fn new(data_dir: &str) -> Self {
        let data_path = PathBuf::from(data_dir);
        let settings_path = data_path.join("shortcuts.json");

        let settings = if settings_path.exists() {
            match fs::read_to_string(&settings_path) {
                Ok(content) => {
                    serde_json::from_str(&content).unwrap_or_else(|_| Self::default_settings())
                }
                Err(_) => Self::default_settings(),
            }
        } else {
            Self::default_settings()
        };

        let current_profile_id = settings.current_profile.clone();

        ShortcutsManager {
            settings,
            current_profile_id,
            data_dir: data_path,
        }
    }

    fn save_settings(&self) -> Result<(), String> {
        if let Err(e) = fs::create_dir_all(&self.data_dir) {
            return Err(format!("Failed to create shortcuts directory: {}", e));
        }
        let settings_path = self.data_dir.join("shortcuts.json");
        let json = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Failed to serialize shortcuts: {}", e))?;
        fs::write(&settings_path, json)
            .map_err(|e| format!("Failed to write shortcuts file: {}", e))?;
        Ok(())
    }

    fn default_settings() -> ShortcutSettings {
        let profile = "default".to_string();
        let ctx = Some("file-explorer".to_string());

        ShortcutSettings {
            current_profile: "default".to_string(),
            global_shortcuts_enabled: true,
            context_aware: true,
            profiles: vec![ShortcutProfile {
                id: "default".to_string(),
                name: "Default".to_string(),
                description: Some("Default shortcut profile".to_string()),
                shortcuts: vec![
                    // ── File Operations ──
                    sb(
                        "copy",
                        &["ctrl", "c"],
                        ShortcutAction::Copy,
                        ctx.clone(),
                        &profile,
                        "Copy selected items",
                        "ctrl+c",
                    ),
                    sb(
                        "cut",
                        &["ctrl", "x"],
                        ShortcutAction::Cut,
                        ctx.clone(),
                        &profile,
                        "Cut selected items",
                        "ctrl+x",
                    ),
                    sb(
                        "paste",
                        &["ctrl", "v"],
                        ShortcutAction::Paste,
                        ctx.clone(),
                        &profile,
                        "Paste items",
                        "ctrl+v",
                    ),
                    sb(
                        "delete",
                        &["del"],
                        ShortcutAction::Delete,
                        ctx.clone(),
                        &profile,
                        "Move to trash",
                        "del",
                    ),
                    sb(
                        "rename",
                        &["f2"],
                        ShortcutAction::Rename,
                        ctx.clone(),
                        &profile,
                        "Rename selected item",
                        "f2",
                    ),
                    sb(
                        "new-folder",
                        &["ctrl", "shift", "n"],
                        ShortcutAction::NewFolder,
                        ctx.clone(),
                        &profile,
                        "Create new folder",
                        "ctrl+shift+n",
                    ),
                    sb(
                        "new-file",
                        &["ctrl", "n"],
                        ShortcutAction::NewFile,
                        ctx.clone(),
                        &profile,
                        "Create new file",
                        "ctrl+n",
                    ),
                    sb(
                        "duplicate",
                        &["ctrl", "d"],
                        ShortcutAction::Duplicate,
                        ctx.clone(),
                        &profile,
                        "Duplicate selected files",
                        "ctrl+d",
                    ),
                    // ── Navigation ──
                    sb(
                        "navigate-back",
                        &["alt", "left"],
                        ShortcutAction::NavigateBack,
                        ctx.clone(),
                        &profile,
                        "Go back",
                        "alt+left",
                    ),
                    sb(
                        "navigate-forward",
                        &["alt", "right"],
                        ShortcutAction::NavigateForward,
                        ctx.clone(),
                        &profile,
                        "Go forward",
                        "alt+right",
                    ),
                    sb(
                        "navigate-up",
                        &["alt", "up"],
                        ShortcutAction::NavigateUp,
                        ctx.clone(),
                        &profile,
                        "Go to parent directory",
                        "alt+up",
                    ),
                    sb(
                        "go-home",
                        &["ctrl", "h"],
                        ShortcutAction::GoHome,
                        ctx.clone(),
                        &profile,
                        "Go to home directory",
                        "ctrl+h",
                    ),
                    sb(
                        "go-to-path",
                        &["ctrl", "l"],
                        ShortcutAction::GoToPath,
                        ctx.clone(),
                        &profile,
                        "Focus address bar",
                        "ctrl+l",
                    ),
                    // ── Selection ──
                    sb(
                        "select-all",
                        &["ctrl", "a"],
                        ShortcutAction::SelectAll,
                        ctx.clone(),
                        &profile,
                        "Select all files",
                        "ctrl+a",
                    ),
                    sb(
                        "invert-selection",
                        &["ctrl", "i"],
                        ShortcutAction::InvertSelection,
                        ctx.clone(),
                        &profile,
                        "Invert selection",
                        "ctrl+i",
                    ),
                    sb(
                        "clear-selection",
                        &["esc"],
                        ShortcutAction::ClearSelection,
                        ctx.clone(),
                        &profile,
                        "Clear selection",
                        "esc",
                    ),
                    // ── Search ──
                    sb(
                        "search",
                        &["ctrl", "f"],
                        ShortcutAction::Search,
                        ctx.clone(),
                        &profile,
                        "Open search",
                        "ctrl+f",
                    ),
                    sb(
                        "quick-search",
                        &["ctrl", "p"],
                        ShortcutAction::QuickSearch,
                        ctx.clone(),
                        &profile,
                        "Quick search",
                        "ctrl+p",
                    ),
                    sb(
                        "natural-language-search",
                        &["ctrl", "shift", "f"],
                        ShortcutAction::NaturalLanguageSearch,
                        ctx.clone(),
                        &profile,
                        "AI-powered search",
                        "ctrl+shift+f",
                    ),
                    sb(
                        "filter-files",
                        &["ctrl", "shift", "p"],
                        ShortcutAction::FilterFiles,
                        ctx.clone(),
                        &profile,
                        "Filter files",
                        "ctrl+shift+p",
                    ),
                    // ── View ──
                    sb(
                        "toggle-left-sidebar",
                        &["ctrl", "b"],
                        ShortcutAction::ToggleLeftSidebar,
                        ctx.clone(),
                        &profile,
                        "Toggle left sidebar",
                        "ctrl+b",
                    ),
                    sb(
                        "toggle-right-sidebar",
                        &["ctrl", "shift", "b"],
                        ShortcutAction::ToggleRightSidebar,
                        ctx.clone(),
                        &profile,
                        "Toggle right sidebar",
                        "ctrl+shift+b",
                    ),
                    sb(
                        "toggle-bottom-panel",
                        &["ctrl", "j"],
                        ShortcutAction::ToggleBottomPanel,
                        ctx.clone(),
                        &profile,
                        "Toggle bottom panel",
                        "ctrl+j",
                    ),
                    sb(
                        "toggle-preview",
                        &["ctrl", "shift", "v"],
                        ShortcutAction::TogglePreview,
                        ctx.clone(),
                        &profile,
                        "Toggle preview panel",
                        "ctrl+shift+v",
                    ),
                    sb(
                        "switch-view-mode",
                        &["ctrl", "shift", "l"],
                        ShortcutAction::SwitchViewMode,
                        ctx.clone(),
                        &profile,
                        "Cycle view mode",
                        "ctrl+shift+l",
                    ),
                    sb(
                        "refresh",
                        &["f5"],
                        ShortcutAction::Refresh,
                        ctx.clone(),
                        &profile,
                        "Refresh directory",
                        "f5",
                    ),
                    sb(
                        "toggle-hidden",
                        &["ctrl", "."],
                        ShortcutAction::ToggleHiddenFiles,
                        ctx.clone(),
                        &profile,
                        "Toggle hidden files",
                        "ctrl+.",
                    ),
                    sb(
                        "zoom-in",
                        &["ctrl", "="],
                        ShortcutAction::ZoomIn,
                        ctx.clone(),
                        &profile,
                        "Zoom in",
                        "ctrl+=",
                    ),
                    sb(
                        "zoom-out",
                        &["ctrl", "-"],
                        ShortcutAction::ZoomOut,
                        ctx.clone(),
                        &profile,
                        "Zoom out",
                        "ctrl+-",
                    ),
                    // ── Application ──
                    sb(
                        "open-settings",
                        &["ctrl", ","],
                        ShortcutAction::OpenSettings,
                        ctx.clone(),
                        &profile,
                        "Open settings",
                        "ctrl+,",
                    ),
                    sb(
                        "close-tab",
                        &["ctrl", "w"],
                        ShortcutAction::CloseTab,
                        ctx.clone(),
                        &profile,
                        "Close current tab",
                        "ctrl+w",
                    ),
                    sb(
                        "next-tab",
                        &["ctrl", "tab"],
                        ShortcutAction::NextTab,
                        ctx.clone(),
                        &profile,
                        "Switch to next tab",
                        "ctrl+tab",
                    ),
                    sb(
                        "prev-tab",
                        &["ctrl", "shift", "tab"],
                        ShortcutAction::PreviousTab,
                        ctx.clone(),
                        &profile,
                        "Switch to previous tab",
                        "ctrl+shift+tab",
                    ),
                    sb(
                        "toggle-fullscreen",
                        &["f11"],
                        ShortcutAction::ToggleFullscreen,
                        ctx.clone(),
                        &profile,
                        "Toggle fullscreen",
                        "f11",
                    ),
                    sb(
                        "new-window",
                        &["ctrl", "shift", "w"],
                        ShortcutAction::NewWindow,
                        ctx.clone(),
                        &profile,
                        "Open new window",
                        "ctrl+shift+w",
                    ),
                    sb(
                        "quit",
                        &["ctrl", "q"],
                        ShortcutAction::Quit,
                        ctx.clone(),
                        &profile,
                        "Quit application",
                        "ctrl+q",
                    ),
                    // ── Terminal ──
                    sb(
                        "open-terminal",
                        &["ctrl", "`"],
                        ShortcutAction::OpenTerminal,
                        ctx.clone(),
                        &profile,
                        "Open terminal",
                        "ctrl+`",
                    ),
                ],
            }],
        }
    }
}

fn parse_action(action: &str, extension_id: Option<String>) -> ShortcutAction {
    match action {
        "Copy" => ShortcutAction::Copy,
        "Cut" => ShortcutAction::Cut,
        "Paste" => ShortcutAction::Paste,
        "Delete" => ShortcutAction::Delete,
        "Rename" => ShortcutAction::Rename,
        "NewFile" => ShortcutAction::NewFile,
        "NewFolder" => ShortcutAction::NewFolder,
        "Duplicate" => ShortcutAction::Duplicate,
        "NavigateUp" | "GoUp" => ShortcutAction::NavigateUp,
        "NavigateBack" | "GoBack" => ShortcutAction::NavigateBack,
        "NavigateForward" | "GoForward" => ShortcutAction::NavigateForward,
        "GoHome" => ShortcutAction::GoHome,
        "GoToPath" => ShortcutAction::GoToPath,
        "Refresh" => ShortcutAction::Refresh,
        "ToggleHiddenFiles" | "ToggleHidden" => ShortcutAction::ToggleHiddenFiles,
        "TogglePreview" => ShortcutAction::TogglePreview,
        "ToggleLeftSidebar" | "ToggleSidebar" | "ToggleDetails" => {
            ShortcutAction::ToggleLeftSidebar
        }
        "ToggleRightSidebar" | "ToggleGrid" => ShortcutAction::ToggleRightSidebar,
        "ToggleBottomPanel" => ShortcutAction::ToggleBottomPanel,
        "SwitchViewMode" => ShortcutAction::SwitchViewMode,
        "ZoomIn" => ShortcutAction::ZoomIn,
        "ZoomOut" => ShortcutAction::ZoomOut,
        "Search" => ShortcutAction::Search,
        "QuickSearch" => ShortcutAction::QuickSearch,
        "NaturalLanguageSearch" => ShortcutAction::NaturalLanguageSearch,
        "FilterFiles" | "Filter" => ShortcutAction::FilterFiles,
        "ClearFilter" => ShortcutAction::ClearFilter,
        "SelectAll" => ShortcutAction::SelectAll,
        "ClearSelection" | "SelectNone" => ShortcutAction::ClearSelection,
        "InvertSelection" => ShortcutAction::InvertSelection,
        "OpenSettings" => ShortcutAction::OpenSettings,
        "ToggleFullscreen" | "Fullscreen" => ShortcutAction::ToggleFullscreen,
        "Quit" => ShortcutAction::Quit,
        "NewWindow" => ShortcutAction::NewWindow,
        "CloseTab" => ShortcutAction::CloseTab,
        "NextTab" => ShortcutAction::NextTab,
        "PreviousTab" => ShortcutAction::PreviousTab,
        "OpenTerminal" | "FocusTerminal" => ShortcutAction::OpenTerminal,
        "OpenAIAssistant" => ShortcutAction::OpenAIAssistant,
        "OpenExtensions" => ShortcutAction::OpenExtensions,
        _ => ShortcutAction::ExtensionAction {
            extension_id: extension_id.unwrap_or_else(|| "unknown".to_string()),
            action_id: action.to_string(),
            params: Some(HashMap::new()),
        },
    }
}

fn format_key_combination(key: &ShortcutKeyInput) -> String {
    let mut parts = Vec::new();
    if key.ctrl || key.meta {
        parts.push("ctrl".to_string());
    }
    if key.alt {
        parts.push("alt".to_string());
    }
    if key.shift {
        parts.push("shift".to_string());
    }
    parts.push(key.key.to_lowercase());
    parts.join("+")
}

// ─── Tauri Commands ─────────────────────────────────────────────────────────

#[command]
pub fn get_shortcuts() -> Result<Vec<ShortcutBinding>, String> {
    let manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_ref() {
        let shortcuts = manager
            .settings
            .profiles
            .iter()
            .find(|p| p.id == manager.current_profile_id)
            .map(|p| p.shortcuts.clone())
            .unwrap_or_default();
        Ok(shortcuts)
    } else {
        Err("Shortcuts manager not initialized".to_string())
    }
}

#[command]
pub fn get_shortcuts_by_category(_category: String) -> Result<Vec<ShortcutBinding>, String> {
    get_shortcuts()
}

#[command]
pub fn add_shortcut(shortcut: ShortcutBinding) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        for profile in &manager.settings.profiles {
            if profile.id == shortcut.profile {
                for existing in &profile.shortcuts {
                    if existing.keys == shortcut.keys && existing.context == shortcut.context {
                        return Err(format!(
                            "Shortcut conflict with existing binding: {}",
                            existing.id
                        ));
                    }
                }
            }
        }

        let target_profile = shortcut.profile.clone();
        if let Some(profile) = manager
            .settings
            .profiles
            .iter_mut()
            .find(|p| p.id == target_profile)
        {
            profile.shortcuts.push(shortcut);
        } else {
            return Err(format!("Profile '{}' not found", target_profile));
        }

        manager.save_settings()?;
        Ok(())
    } else {
        Err("Shortcuts manager not initialized".to_string())
    }
}

#[command]
pub fn update_shortcut(binding: ShortcutBinding) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        if let Some(profile) = manager
            .settings
            .profiles
            .iter_mut()
            .find(|p| p.id == binding.profile)
        {
            if let Some(existing) = profile.shortcuts.iter_mut().find(|s| s.id == binding.id) {
                *existing = binding;
                manager.save_settings()?;
                return Ok(());
            }
            return Err("Shortcut not found".to_string());
        }
        return Err("Profile not found".to_string());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn remove_shortcut(shortcut_id: String) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        for profile in &mut manager.settings.profiles {
            let before = profile.shortcuts.len();
            profile.shortcuts.retain(|s| s.id != shortcut_id);
            if profile.shortcuts.len() != before {
                manager.save_settings()?;
                return Ok(());
            }
        }
        return Err("Shortcut not found".to_string());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn get_shortcut_profiles() -> Result<Vec<String>, String> {
    let manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_ref() {
        let profiles = manager
            .settings
            .profiles
            .iter()
            .map(|p| p.id.clone())
            .collect();
        Ok(profiles)
    } else {
        Err("Shortcuts manager not initialized".to_string())
    }
}

#[command]
pub fn switch_shortcut_profile(profile_id: String) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        if manager.settings.profiles.iter().any(|p| p.id == profile_id) {
            manager.current_profile_id = profile_id.clone();
            manager.settings.current_profile = profile_id;
            manager.save_settings()?;
            return Ok(());
        }
        return Err("Profile not found".to_string());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn get_shortcut_settings() -> Result<ShortcutSettings, String> {
    let manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_ref() {
        return Ok(manager.settings.clone());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn update_shortcut_settings(settings: ShortcutSettings) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        manager.current_profile_id = settings.current_profile.clone();
        manager.settings = settings;
        manager.save_settings()?;
        return Ok(());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn execute_shortcut_action(
    key_combination: String,
    context: String,
) -> Result<Option<ShortcutAction>, String> {
    let manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_ref() {
        let action = manager
            .settings
            .profiles
            .iter()
            .find(|p| p.id == manager.current_profile_id)
            .and_then(|p| {
                p.shortcuts.iter().find(|s| {
                    s.enabled
                        && s.key_combination == key_combination
                        && (s.context.is_none() || s.context.as_ref() == Some(&context))
                })
            })
            .map(|s| s.action.clone());
        return Ok(action);
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn register_extension_shortcut(
    extension_id: String,
    shortcut_id: String,
    name: String,
    description: Option<String>,
    key_combination: ShortcutKeyInput,
    action: String,
    context: Vec<String>,
) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        let current_profile = manager.current_profile_id.clone();
        let Some(profile) = manager
            .settings
            .profiles
            .iter_mut()
            .find(|p| p.id == current_profile)
        else {
            return Err("Current profile not found".to_string());
        };

        let key_string = format_key_combination(&key_combination);
        let keys: Vec<String> = key_string.split('+').map(|v| v.to_string()).collect();

        profile.shortcuts.push(ShortcutBinding {
            id: format!("{}.{}", extension_id, shortcut_id),
            keys,
            action: parse_action(&action, Some(extension_id)),
            context: context.first().cloned(),
            enabled: true,
            profile: profile.id.clone(),
            description: description.or(Some(name)),
            global: false,
            key_combination: key_string,
        });

        manager.save_settings()?;
        return Ok(());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn unregister_extension_shortcuts(extension_id: String) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        for profile in &mut manager.settings.profiles {
            profile
                .shortcuts
                .retain(|s| !s.id.starts_with(&format!("{}.", extension_id)));
        }
        manager.save_settings()?;
        return Ok(());
    }
    Err("Shortcuts manager not initialized".to_string())
}

#[command]
pub fn reset_shortcuts(profile_id: Option<String>) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        let defaults = ShortcutsManager::default_settings();
        let target_id = profile_id.unwrap_or_else(|| manager.current_profile_id.clone());
        if let Some(profile) = manager
            .settings
            .profiles
            .iter_mut()
            .find(|p| p.id == target_id)
        {
            // Keep extension shortcuts (ids contain a dot), reset only built-in ones
            let extension_shortcuts: Vec<ShortcutBinding> = profile
                .shortcuts
                .iter()
                .filter(|s| s.id.contains('.'))
                .cloned()
                .collect();
            profile.shortcuts = default_profile_shortcuts(&defaults);
            profile.shortcuts.extend(extension_shortcuts);
        }
        manager.save_settings()?;
        Ok(())
    } else {
        Err("Shortcuts manager not initialized".to_string())
    }
}

#[command]
pub fn reset_single_shortcut(shortcut_id: String) -> Result<ShortcutBinding, String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        let defaults = ShortcutsManager::default_settings();
        let default_binding = defaults
            .profiles
            .first()
            .and_then(|p| p.shortcuts.iter().find(|s| s.id == shortcut_id))
            .cloned()
            .ok_or_else(|| format!("No default found for shortcut '{}'", shortcut_id))?;

        let current_profile = manager.current_profile_id.clone();
        if let Some(profile) = manager
            .settings
            .profiles
            .iter_mut()
            .find(|p| p.id == current_profile)
        {
            if let Some(existing) = profile.shortcuts.iter_mut().find(|s| s.id == shortcut_id) {
                *existing = default_binding.clone();
            }
        }
        manager.save_settings()?;
        Ok(default_binding)
    } else {
        Err("Shortcuts manager not initialized".to_string())
    }
}

fn default_profile_shortcuts(settings: &ShortcutSettings) -> Vec<ShortcutBinding> {
    settings
        .profiles
        .first()
        .map(|p| p.shortcuts.clone())
        .unwrap_or_default()
}

#[command]
pub fn register_global_shortcuts() -> Result<(), String> {
    Ok(())
}

#[command]
pub fn unregister_global_shortcuts() -> Result<(), String> {
    Ok(())
}

#[command]
pub fn toggle_global_shortcuts(enabled: bool) -> Result<(), String> {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(manager) = manager_guard.as_mut() {
        manager.settings.global_shortcuts_enabled = enabled;
        manager.save_settings()?;
        return Ok(());
    }
    Err("Shortcuts manager not initialized".to_string())
}

pub fn init_shortcuts_manager(data_dir: &str) {
    let mut manager_guard = SHORTCUTS_MANAGER.lock().unwrap_or_else(|e| e.into_inner());
    *manager_guard = Some(ShortcutsManager::new(data_dir));
}
