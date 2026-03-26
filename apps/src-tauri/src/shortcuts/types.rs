use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ShortcutAction {
    // File operations
    Copy,
    Cut,
    Paste,
    Delete,
    Rename,
    NewFile,
    NewFolder,
    Duplicate,

    // Navigation
    #[serde(alias = "GoUp")]
    NavigateUp,
    #[serde(alias = "GoBack")]
    NavigateBack,
    #[serde(alias = "GoForward")]
    NavigateForward,
    GoHome,
    GoToPath,

    // View operations
    Refresh,
    #[serde(alias = "ToggleHidden")]
    ToggleHiddenFiles,
    TogglePreview,
    #[serde(alias = "ToggleSidebar", alias = "ToggleDetails")]
    ToggleLeftSidebar,
    #[serde(alias = "ToggleGrid")]
    ToggleRightSidebar,
    ToggleBottomPanel,
    SwitchViewMode,
    ZoomIn,
    ZoomOut,

    // Search and filter
    Search,
    QuickSearch,
    NaturalLanguageSearch,
    #[serde(alias = "Filter")]
    FilterFiles,
    ClearFilter,

    // Selection
    SelectAll,
    #[serde(alias = "SelectNone")]
    ClearSelection,
    InvertSelection,

    // Application operations
    OpenSettings,
    #[serde(alias = "Fullscreen")]
    ToggleFullscreen,
    Quit,
    NewWindow,
    CloseTab,
    NextTab,
    PreviousTab,

    // Terminal / AI
    #[serde(alias = "FocusTerminal")]
    OpenTerminal,
    OpenAIAssistant,
    OpenExtensions,

    // Extension operations
    ExtensionAction {
        extension_id: String,
        action_id: String,
        params: Option<HashMap<String, String>>,
    },

    // Legacy (kept for backward compat)
    Save,
    SaveAs,
    Open,
    OpenWith,
    Properties,
    FocusExplorer,
    FocusSearch,
    Minimize,
    Maximize,
    Cancel,
    Undo,
    Redo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutBinding {
    pub id: String,
    pub keys: Vec<String>, // e.g., ["ctrl", "c"]
    pub action: ShortcutAction,
    pub context: Option<String>, // Where this shortcut is active
    pub enabled: bool,
    pub profile: String,
    pub description: Option<String>,
    pub global: bool,            // Whether this is a global system shortcut
    pub key_combination: String, // Combined representation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub shortcuts: Vec<ShortcutBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutSettings {
    pub current_profile: String,
    pub global_shortcuts_enabled: bool,
    pub context_aware: bool,
    pub profiles: Vec<ShortcutProfile>,
}
