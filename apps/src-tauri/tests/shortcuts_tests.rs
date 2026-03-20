use xplorer::shortcuts::types::*;
use xplorer::shortcuts::manager::*;
use std::collections::HashMap;
use tempfile::TempDir;

#[test]
fn test_shortcut_action_serialization() {
    let action = ShortcutAction::Copy;
    let json = serde_json::to_string(&action).unwrap();
    let deserialized: ShortcutAction = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized, ShortcutAction::Copy);
}

#[test]
fn test_shortcut_action_extension_action() {
    let mut params = HashMap::new();
    params.insert("theme".to_string(), "dark".to_string());

    let action = ShortcutAction::ExtensionAction {
        extension_id: "theme-switcher".to_string(),
        action_id: "toggle".to_string(),
        params: Some(params),
    };

    let json = serde_json::to_string(&action).unwrap();
    let deserialized: ShortcutAction = serde_json::from_str(&json).unwrap();

    match deserialized {
        ShortcutAction::ExtensionAction { extension_id, action_id, params } => {
            assert_eq!(extension_id, "theme-switcher");
            assert_eq!(action_id, "toggle");
            assert!(params.is_some());
            assert_eq!(params.unwrap().get("theme").unwrap(), "dark");
        }
        _ => panic!("Expected ExtensionAction"),
    }
}

#[test]
fn test_shortcut_binding_serialization() {
    let binding = ShortcutBinding {
        id: "test_shortcut".to_string(),
        keys: vec!["ctrl".to_string(), "n".to_string()],
        action: ShortcutAction::NewFile,
        context: Some("explorer".to_string()),
        enabled: true,
        profile: "default".to_string(),
        description: Some("Test shortcut".to_string()),
        global: false,
        key_combination: "ctrl+n".to_string(),
    };

    let json = serde_json::to_string(&binding).unwrap();
    let deserialized: ShortcutBinding = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.id, "test_shortcut");
    assert_eq!(deserialized.keys, vec!["ctrl", "n"]);
    assert_eq!(deserialized.action, ShortcutAction::NewFile);
    assert_eq!(deserialized.context, Some("explorer".to_string()));
    assert!(deserialized.enabled);
    assert!(!deserialized.global);
    assert_eq!(deserialized.key_combination, "ctrl+n");
}

#[test]
fn test_shortcut_settings_serialization() {
    let settings = ShortcutSettings {
        current_profile: "default".to_string(),
        global_shortcuts_enabled: true,
        context_aware: true,
        profiles: vec![ShortcutProfile {
            id: "default".to_string(),
            name: "Default".to_string(),
            description: Some("Default profile".to_string()),
            shortcuts: vec![],
        }],
    };

    let json = serde_json::to_string(&settings).unwrap();
    let deserialized: ShortcutSettings = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.current_profile, "default");
    assert!(deserialized.global_shortcuts_enabled);
    assert!(deserialized.context_aware);
    assert_eq!(deserialized.profiles.len(), 1);
    assert_eq!(deserialized.profiles[0].id, "default");
}

#[test]
fn test_shortcuts_manager_default_settings() {
    let temp_dir = TempDir::new().unwrap();
    let manager = ShortcutsManager::new(temp_dir.path().to_str().unwrap());

    // The default profile should have shortcuts
    assert!(!manager.settings.profiles.is_empty());
    assert_eq!(manager.settings.current_profile, "default");
    assert_eq!(manager.current_profile_id, "default");

    // Default profile should have built-in shortcuts
    let default_profile = &manager.settings.profiles[0];
    assert_eq!(default_profile.id, "default");
    assert!(!default_profile.shortcuts.is_empty());
}

#[test]
fn test_shortcuts_manager_persistence() {
    let temp_dir = TempDir::new().unwrap();
    let data_dir = temp_dir.path().to_str().unwrap();

    // Create a manager and verify defaults
    let manager1 = ShortcutsManager::new(data_dir);
    let shortcut_count = manager1.settings.profiles[0].shortcuts.len();
    assert!(shortcut_count > 0);

    // Create a second manager from the same directory -- it should load saved settings
    let manager2 = ShortcutsManager::new(data_dir);
    assert_eq!(manager2.settings.profiles[0].shortcuts.len(), shortcut_count);
}

#[test]
fn test_shortcut_action_serde_aliases() {
    // Test that legacy aliases still deserialize correctly
    let json = r#""GoUp""#;
    let action: ShortcutAction = serde_json::from_str(json).unwrap();
    assert_eq!(action, ShortcutAction::NavigateUp);

    let json = r#""GoBack""#;
    let action: ShortcutAction = serde_json::from_str(json).unwrap();
    assert_eq!(action, ShortcutAction::NavigateBack);

    let json = r#""ToggleHidden""#;
    let action: ShortcutAction = serde_json::from_str(json).unwrap();
    assert_eq!(action, ShortcutAction::ToggleHiddenFiles);

    let json = r#""Fullscreen""#;
    let action: ShortcutAction = serde_json::from_str(json).unwrap();
    assert_eq!(action, ShortcutAction::ToggleFullscreen);
}

#[test]
fn test_all_shortcut_actions_roundtrip() {
    // Test a representative sample of actions for serialization round-trip
    let actions = vec![
        ShortcutAction::Copy,
        ShortcutAction::Cut,
        ShortcutAction::Paste,
        ShortcutAction::Delete,
        ShortcutAction::Rename,
        ShortcutAction::NewFile,
        ShortcutAction::NewFolder,
        ShortcutAction::NavigateUp,
        ShortcutAction::NavigateBack,
        ShortcutAction::NavigateForward,
        ShortcutAction::GoHome,
        ShortcutAction::Refresh,
        ShortcutAction::Search,
        ShortcutAction::SelectAll,
        ShortcutAction::OpenSettings,
        ShortcutAction::Quit,
        ShortcutAction::OpenTerminal,
        ShortcutAction::Undo,
        ShortcutAction::Redo,
    ];

    for action in actions {
        let json = serde_json::to_string(&action).unwrap();
        let deserialized: ShortcutAction = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, action, "Round-trip failed for {:?}", action);
    }
}
