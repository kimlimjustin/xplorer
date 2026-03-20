use xplorer::git_history::*;

#[test]
fn test_git_commit_serialization() {
    let commit = GitCommit {
        hash: "abc123def456".to_string(),
        short_hash: "abc123d".to_string(),
        author_name: "Test User".to_string(),
        author_email: "test@example.com".to_string(),
        committer_name: "Test User".to_string(),
        committer_email: "test@example.com".to_string(),
        date: "2024-01-01T00:00:00Z".to_string(),
        timestamp: 1704067200,
        message: "Initial commit\n\nThis is the body.".to_string(),
        summary: "Initial commit".to_string(),
        body: Some("This is the body.".to_string()),
        parent_hashes: vec!["parent123".to_string()],
        files_changed: vec!["file.txt".to_string()],
        insertions: 10,
        deletions: 5,
    };

    let json = serde_json::to_string(&commit).unwrap();
    let deserialized: GitCommit = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.hash, "abc123def456");
    assert_eq!(deserialized.short_hash, "abc123d");
    assert_eq!(deserialized.author_name, "Test User");
    assert_eq!(deserialized.author_email, "test@example.com");
    assert_eq!(deserialized.summary, "Initial commit");
    assert_eq!(deserialized.body, Some("This is the body.".to_string()));
    assert_eq!(deserialized.insertions, 10);
    assert_eq!(deserialized.deletions, 5);
}

#[test]
fn test_git_file_history_serialization() {
    let history = GitFileHistory {
        file_path: "src/main.rs".to_string(),
        commits: vec![],
        total_commits: 0,
        first_commit: None,
        last_commit: None,
        total_lines_added: 0,
        total_lines_deleted: 0,
    };

    let json = serde_json::to_string(&history).unwrap();
    let deserialized: GitFileHistory = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.file_path, "src/main.rs");
    assert_eq!(deserialized.total_commits, 0);
    assert!(deserialized.first_commit.is_none());
    assert!(deserialized.last_commit.is_none());
}

#[test]
fn test_git_file_blame_serialization() {
    let blame = GitFileBlame {
        file_path: "src/main.rs".to_string(),
        lines: vec![GitBlameLine {
            line_number: 1,
            content: "fn main() {}".to_string(),
            commit_hash: "abc123".to_string(),
            short_hash: "abc12".to_string(),
            author_name: "Dev".to_string(),
            author_email: "dev@test.com".to_string(),
            date: "2024-01-01".to_string(),
            timestamp: 1704067200,
            summary: "Initial commit".to_string(),
        }],
        unique_authors: vec!["Dev".to_string()],
        total_lines: 1,
    };

    let json = serde_json::to_string(&blame).unwrap();
    let deserialized: GitFileBlame = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.file_path, "src/main.rs");
    assert_eq!(deserialized.lines.len(), 1);
    assert_eq!(deserialized.lines[0].content, "fn main() {}");
    assert_eq!(deserialized.unique_authors, vec!["Dev"]);
    assert_eq!(deserialized.total_lines, 1);
}

#[test]
fn test_git_commit_empty_body() {
    let commit = GitCommit {
        hash: "abc".to_string(),
        short_hash: "abc".to_string(),
        author_name: "Test".to_string(),
        author_email: "test@test.com".to_string(),
        committer_name: "Test".to_string(),
        committer_email: "test@test.com".to_string(),
        date: "2024-01-01".to_string(),
        timestamp: 0,
        message: "Simple commit".to_string(),
        summary: "Simple commit".to_string(),
        body: None,
        parent_hashes: vec![],
        files_changed: vec![],
        insertions: 0,
        deletions: 0,
    };

    let json = serde_json::to_string(&commit).unwrap();
    let deserialized: GitCommit = serde_json::from_str(&json).unwrap();
    assert!(deserialized.body.is_none());
    assert!(deserialized.parent_hashes.is_empty());
    assert!(deserialized.files_changed.is_empty());
}
