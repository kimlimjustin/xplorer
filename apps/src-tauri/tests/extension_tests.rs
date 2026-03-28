use xplorer::extensions::permissions::*;
use xplorer::extensions::types::*;

#[test]
fn test_extension_manifest_parsing() {
    let manifest_json = r#"{
        "id": "test-extension",
        "name": "Test Extension",
        "display_name": "Test Extension Display",
        "description": "A test extension",
        "version": "1.0.0",
        "author": "Test Author",
        "category": "tool",
        "permissions": ["file:read", "ui:notifications"],
        "main": "index.js"
    }"#;

    let manifest: ExtensionManifest = serde_json::from_str(manifest_json).unwrap();

    assert_eq!(manifest.id, "test-extension");
    assert_eq!(manifest.name, "Test Extension");
    assert_eq!(manifest.version, "1.0.0");
    assert_eq!(manifest.category, "tool");
    assert!(manifest.permissions.is_some());
    assert_eq!(manifest.permissions.as_ref().unwrap().len(), 2);
}

#[test]
fn test_permission_from_string() {
    assert_eq!(
        ExtensionPermission::from_string("file:read"),
        Some(ExtensionPermission::FileRead)
    );
    assert_eq!(
        ExtensionPermission::from_string("file:write"),
        Some(ExtensionPermission::FileWrite)
    );
    assert_eq!(
        ExtensionPermission::from_string("system:commands"),
        Some(ExtensionPermission::ExecuteCommands)
    );
    assert_eq!(ExtensionPermission::from_string("invalid:permission"), None);
}

#[test]
fn test_permission_validation() {
    let permissions = vec![
        "file:read".to_string(),
        "file:write".to_string(),
        "system:commands".to_string(),
        "invalid:permission".to_string(),
    ];

    let valid_permissions: Vec<ExtensionPermission> = permissions
        .iter()
        .filter_map(|p| ExtensionPermission::from_string(p))
        .collect();

    assert_eq!(valid_permissions.len(), 3);
    assert!(valid_permissions.contains(&ExtensionPermission::FileRead));
    assert!(valid_permissions.contains(&ExtensionPermission::FileWrite));
    assert!(valid_permissions.contains(&ExtensionPermission::ExecuteCommands));
}

#[test]
fn test_extension_contributes() {
    let contributes = ExtensionContributes {
        panels: Some(vec![PanelContribution {
            id: "test-panel".to_string(),
            title: "Test Panel".to_string(),
            location: "sidebar".to_string(),
            icon: Some("icon.svg".to_string()),
            when: Some("fileExplorer.active".to_string()),
        }]),
        commands: Some(vec![CommandContribution {
            command: "test.command".to_string(),
            title: "Test Command".to_string(),
            category: Some("Test".to_string()),
            icon: None,
        }]),
        themes: Some(vec!["dark-theme.json".to_string()]),
        file_types: None,
        context_menus: None,
        keybindings: None,
    };

    assert!(contributes.panels.is_some());
    assert_eq!(contributes.panels.as_ref().unwrap().len(), 1);
    assert_eq!(contributes.panels.as_ref().unwrap()[0].id, "test-panel");

    assert!(contributes.commands.is_some());
    assert_eq!(contributes.commands.as_ref().unwrap().len(), 1);
    assert_eq!(
        contributes.commands.as_ref().unwrap()[0].command,
        "test.command"
    );
}

#[test]
fn test_parse_manifest_from_package_json_flat() {
    let json = r#"{
        "id": "flat-ext",
        "name": "Flat Extension",
        "version": "2.0.0",
        "author": "Author",
        "category": "tool",
        "main": "index.js",
        "description": "A flat extension manifest"
    }"#;

    let manifest = parse_manifest_from_package_json(json).unwrap();
    assert_eq!(manifest.id, "flat-ext");
    assert_eq!(manifest.version, "2.0.0");
    assert_eq!(
        manifest.description,
        Some("A flat extension manifest".to_string())
    );
}

#[test]
fn test_parse_manifest_from_package_json_nested() {
    let json = r#"{
        "name": "my-extension-package",
        "version": "1.0.0",
        "main": "dist/index.js",
        "description": "Top-level description",
        "xplorer": {
            "id": "nested-ext",
            "name": "Nested Extension",
            "version": "1.0.0",
            "author": "Author",
            "category": "tool"
        }
    }"#;

    let manifest = parse_manifest_from_package_json(json).unwrap();
    assert_eq!(manifest.id, "nested-ext");
    // main should be inherited from top level
    assert_eq!(manifest.main, Some("dist/index.js".to_string()));
    // description should be inherited from top level
    assert_eq!(
        manifest.description,
        Some("Top-level description".to_string())
    );
}

#[test]
fn test_extension_manifest_roundtrip() {
    let manifest = ExtensionManifest {
        id: "roundtrip-test".to_string(),
        name: "Roundtrip Test".to_string(),
        display_name: Some("Roundtrip".to_string()),
        description: Some("Test roundtrip".to_string()),
        version: "1.0.0".to_string(),
        author: "Test".to_string(),
        category: "tool".to_string(),
        icon: None,
        keywords: Some(vec!["test".to_string()]),
        homepage: None,
        repository: None,
        license: Some("MIT".to_string()),
        permissions: Some(vec!["file:read".to_string()]),
        activation_events: None,
        main: Some("index.js".to_string()),
        contributes: None,
    };

    let json = serde_json::to_string(&manifest).unwrap();
    let deserialized: ExtensionManifest = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.id, "roundtrip-test");
    assert_eq!(deserialized.display_name, Some("Roundtrip".to_string()));
    assert_eq!(deserialized.license, Some("MIT".to_string()));
    assert_eq!(deserialized.keywords, Some(vec!["test".to_string()]));
}

#[test]
fn test_context_menu_contribution() {
    let json = r#"{
        "command": "ext.doSomething",
        "when": "resourceExtname == .json",
        "group": "mygroup"
    }"#;

    let contribution: ContextMenuContribution = serde_json::from_str(json).unwrap();
    assert_eq!(contribution.command, "ext.doSomething");
    assert_eq!(
        contribution.when,
        Some("resourceExtname == .json".to_string())
    );
    assert_eq!(contribution.group, Some("mygroup".to_string()));
}

#[test]
fn test_theme_data_serialization() {
    let theme_json = r##"{
        "name": "test-theme",
        "theme_type": "dark",
        "colors": {
            "background": "#1a1a1a",
            "foreground": "#ffffff",
            "accent": "#007acc"
        }
    }"##;

    let theme: ThemeData = serde_json::from_str(theme_json).unwrap();
    assert_eq!(theme.name, "test-theme");
    assert_eq!(theme.theme_type, "dark");
    assert_eq!(theme.colors.get("background").unwrap(), "#1a1a1a");
    assert_eq!(theme.colors.get("foreground").unwrap(), "#ffffff");
}
