use std::fs;
use tempfile::TempDir;
use xplorer::duplicate_finder::*;
use xplorer::extensions::permissions::*;
use xplorer::extensions::types::*;
use xplorer::git_history::*;
use xplorer::shortcuts::manager::*;
use xplorer::shortcuts::types::*;

/// Test that extension manifest parsing works with contributes, context menus, etc.
#[test]
fn test_complete_extension_manifest_workflow() {
    let manifest = ExtensionManifest {
        id: "workflow-test".to_string(),
        name: "Workflow Test Extension".to_string(),
        display_name: Some("Workflow Test".to_string()),
        description: Some("Test extension for workflow".to_string()),
        version: "1.0.0".to_string(),
        author: "Test Author".to_string(),
        category: "tool".to_string(),
        icon: None,
        keywords: Some(vec!["test".to_string(), "workflow".to_string()]),
        homepage: None,
        repository: None,
        license: Some("MIT".to_string()),
        permissions: Some(vec![
            "file:read".to_string(),
            "ui:notifications".to_string(),
        ]),
        activation_events: Some(vec!["onFileOpen:*.json".to_string()]),
        main: Some("index.js".to_string()),
        contributes: Some(ExtensionContributes {
            panels: Some(vec![PanelContribution {
                id: "workflow-panel".to_string(),
                title: "Workflow Panel".to_string(),
                location: "sidebar".to_string(),
                icon: Some("workflow.svg".to_string()),
                when: Some("explorerResourceIsFile".to_string()),
            }]),
            commands: Some(vec![CommandContribution {
                command: "workflow.analyze".to_string(),
                title: "Analyze Workflow".to_string(),
                category: Some("Workflow".to_string()),
                icon: Some("analyze.svg".to_string()),
            }]),
            themes: None,
            file_types: None,
            context_menus: Some(vec![ContextMenuContribution {
                command: "workflow.analyze".to_string(),
                when: Some("resourceExtname == .json".to_string()),
                group: Some("workflow".to_string()),
            }]),
            keybindings: None,
        }),
    };

    // Verify serialization roundtrip
    let json = serde_json::to_string_pretty(&manifest).unwrap();
    let deserialized: ExtensionManifest = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.id, "workflow-test");
    assert_eq!(deserialized.version, "1.0.0");
    assert!(deserialized.contributes.is_some());

    let contributes = deserialized.contributes.unwrap();
    assert!(contributes.panels.is_some());
    assert!(contributes.commands.is_some());
    assert!(contributes.context_menus.is_some());
    assert_eq!(
        contributes.context_menus.unwrap()[0].command,
        "workflow.analyze"
    );

    // Verify permissions parse correctly
    let parsed_perms: Vec<ExtensionPermission> = deserialized
        .permissions
        .unwrap()
        .iter()
        .filter_map(|p| ExtensionPermission::from_string(p))
        .collect();
    assert_eq!(parsed_perms.len(), 2);
    assert!(parsed_perms.contains(&ExtensionPermission::FileRead));
    assert!(parsed_perms.contains(&ExtensionPermission::ShowNotifications));
}

/// Test shortcuts manager with shortcut bindings and extension action creation
#[test]
fn test_shortcut_binding_with_extension_action_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let shortcuts_dir = temp_dir.path().join("shortcuts");
    fs::create_dir(&shortcuts_dir).unwrap();

    // Create shortcuts manager
    let manager = ShortcutsManager::new(shortcuts_dir.to_str().unwrap());

    // Verify default shortcuts exist
    assert!(!manager.settings.profiles.is_empty());
    let default_profile = &manager.settings.profiles[0];
    assert!(!default_profile.shortcuts.is_empty());

    // Verify we can create extension action shortcut bindings
    let ext_shortcut = ShortcutBinding {
        id: "workflow_analyze".to_string(),
        keys: vec!["ctrl".to_string(), "shift".to_string(), "w".to_string()],
        action: ShortcutAction::ExtensionAction {
            extension_id: "workflow-test".to_string(),
            action_id: "analyze".to_string(),
            params: None,
        },
        context: Some("explorer".to_string()),
        enabled: true,
        profile: "default".to_string(),
        description: Some("Analyze file with workflow extension".to_string()),
        global: false,
        key_combination: "ctrl+shift+w".to_string(),
    };

    // Verify serialization
    let json = serde_json::to_string(&ext_shortcut).unwrap();
    let deserialized: ShortcutBinding = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.id, "workflow_analyze");
    match &deserialized.action {
        ShortcutAction::ExtensionAction {
            extension_id,
            action_id,
            ..
        } => {
            assert_eq!(extension_id, "workflow-test");
            assert_eq!(action_id, "analyze");
        }
        _ => panic!("Expected ExtensionAction"),
    }
}

/// Test duplicate finder builder and type integration
#[test]
fn test_duplicate_finder_integration() {
    // Test the builder pattern chain
    let _finder = DuplicateFinder::new()
        .min_file_size(1)
        .max_file_size(10_000_000)
        .include_hidden(false)
        .file_extensions(vec!["txt".into(), "rs".into(), "json".into()]);

    // Test that result types serialize/deserialize correctly in a workflow context
    let result = DuplicateFinderResult {
        duplicate_groups: vec![DuplicateGroup {
            hash: "workflow_hash".to_string(),
            size: 2048,
            files: vec![
                DuplicateFile {
                    path: "file1.txt".into(),
                    name: "file1.txt".into(),
                    size: 2048,
                    hash: "workflow_hash".into(),
                    modified: 100,
                },
                DuplicateFile {
                    path: "file2.txt".into(),
                    name: "file2.txt".into(),
                    size: 2048,
                    hash: "workflow_hash".into(),
                    modified: 200,
                },
            ],
            total_wasted_space: 2048,
        }],
        total_duplicates: 2,
        total_wasted_space: 2048,
        scan_time_ms: 15,
        files_scanned: 3,
    };

    let json = serde_json::to_string(&result).unwrap();
    let deserialized: DuplicateFinderResult = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.duplicate_groups.len(), 1);
    assert_eq!(deserialized.duplicate_groups[0].files.len(), 2);
    assert_eq!(deserialized.total_wasted_space, 2048);
}

/// Test git history type serialization
#[test]
fn test_git_types_integration() {
    let commit = GitCommit {
        hash: "abc123".to_string(),
        short_hash: "abc12".to_string(),
        author_name: "Test User".to_string(),
        author_email: "test@example.com".to_string(),
        committer_name: "Test User".to_string(),
        committer_email: "test@example.com".to_string(),
        date: "2024-01-01".to_string(),
        timestamp: 1704067200,
        message: "Initial commit with duplicates".to_string(),
        summary: "Initial commit with duplicates".to_string(),
        body: None,
        parent_hashes: vec![],
        files_changed: vec!["file1.txt".to_string(), "file2.txt".to_string()],
        insertions: 2,
        deletions: 0,
    };

    let history = GitFileHistory {
        file_path: "file1.txt".to_string(),
        commits: vec![commit.clone()],
        total_commits: 1,
        first_commit: Some(commit.clone()),
        last_commit: Some(commit),
        total_lines_added: 2,
        total_lines_deleted: 0,
    };

    // Verify serialization roundtrip
    let json = serde_json::to_string(&history).unwrap();
    let deserialized: GitFileHistory = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.file_path, "file1.txt");
    assert_eq!(deserialized.total_commits, 1);
    assert!(deserialized.first_commit.is_some());
}
