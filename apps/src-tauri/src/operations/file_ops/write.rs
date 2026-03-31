use crate::operations::validate_file_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileTemplate {
    pub id: String,
    pub name: String,
    pub default_filename: String,
    pub extension: String,
    pub description: String,
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&path);

        if path.exists() {
            return Err(format!("File already exists: {}", path.display()));
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        fs::File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_file_with_content(path: String, content: String) -> Result<(), String> {
    validate_file_path(&path)?;

    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);

        if file_path.exists() {
            return Err(format!("File already exists: {}", path));
        }

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        fs::write(file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_file_templates() -> Result<Vec<FileTemplate>, String> {
    Ok(vec![
        FileTemplate {
            id: "html".into(),
            name: "HTML Page".into(),
            default_filename: "index.html".into(),
            extension: "html".into(),
            description: "HTML5 boilerplate page".into(),
        },
        FileTemplate {
            id: "react".into(),
            name: "React Component".into(),
            default_filename: "Component.tsx".into(),
            extension: "tsx".into(),
            description: "React functional component".into(),
        },
        FileTemplate {
            id: "python".into(),
            name: "Python Script".into(),
            default_filename: "script.py".into(),
            extension: "py".into(),
            description: "Python script with main guard".into(),
        },
        FileTemplate {
            id: "markdown".into(),
            name: "Markdown Document".into(),
            default_filename: "document.md".into(),
            extension: "md".into(),
            description: "Markdown document with sections".into(),
        },
        FileTemplate {
            id: "json".into(),
            name: "JSON File".into(),
            default_filename: "data.json".into(),
            extension: "json".into(),
            description: "Empty JSON object".into(),
        },
        FileTemplate {
            id: "css".into(),
            name: "CSS Stylesheet".into(),
            default_filename: "styles.css".into(),
            extension: "css".into(),
            description: "CSS stylesheet with basic reset".into(),
        },
        FileTemplate {
            id: "typescript".into(),
            name: "TypeScript Module".into(),
            default_filename: "module.ts".into(),
            extension: "ts".into(),
            description: "TypeScript module with export".into(),
        },
        FileTemplate {
            id: "shell".into(),
            name: "Shell Script".into(),
            default_filename: "script.sh".into(),
            extension: "sh".into(),
            description: "Bash shell script".into(),
        },
    ])
}

fn get_template_content(template_id: &str) -> Result<String, String> {
    match template_id {
        "html" => Ok("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>\n".to_string()),
        "react" => Ok("import React from 'react';\n\ninterface Props {\n  // Define your props here\n}\n\nexport default function Component({ }: Props) {\n  return (\n    <div>\n      <h1>Component</h1>\n    </div>\n  );\n}\n".to_string()),
        "python" => Ok("#!/usr/bin/env python3\n\"\"\"Module docstring.\"\"\"\n\n\ndef main():\n    \"\"\"Main function.\"\"\"\n    pass\n\n\nif __name__ == \"__main__\":\n    main()\n".to_string()),
        "markdown" => Ok("# Title\n\n## Introduction\n\nWrite your introduction here.\n\n## Content\n\nMain content goes here.\n\n## Conclusion\n\nWrap up your document here.\n".to_string()),
        "json" => Ok("{\n}\n".to_string()),
        "css" => Ok("/* Reset */\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  line-height: 1.6;\n}\n".to_string()),
        "typescript" => Ok("export interface Config {\n  // Define your config here\n}\n\nexport function init(config: Config): void {\n  // Initialize module\n}\n".to_string()),
        "shell" => Ok("#!/bin/bash\nset -euo pipefail\n\n# Script description here\n\nmain() {\n    echo \"Hello, World!\"\n}\n\nmain \"$@\"\n".to_string()),
        _ => Err(format!("Unknown template: {}", template_id)),
    }
}

#[command]
pub async fn create_from_template(
    directory: String,
    template_id: String,
    filename: String,
) -> Result<String, String> {
    let content = get_template_content(&template_id)?;

    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&directory).join(&filename);
        if file_path.exists() {
            return Err(format!("File already exists: {}", file_path.display()));
        }
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        Ok(file_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Symbolic Link Creation ──────────────────────────────────────────────────

#[command]
pub async fn create_symlink(target: String, link_path: String) -> Result<(), String> {
    // Validate both paths
    validate_file_path(&target)?;
    validate_file_path(&link_path)?;

    tokio::task::spawn_blocking(move || {
        let target_path = Path::new(&target);
        let link = Path::new(&link_path);

        // Ensure target exists
        if !target_path.exists() {
            return Err(format!("Target does not exist: {}", target));
        }

        // Ensure link does not already exist
        if link.exists() || link.symlink_metadata().is_ok() {
            return Err(format!("A file or link already exists at: {}", link_path));
        }

        // Ensure parent directory of the link exists
        if let Some(parent) = link.parent() {
            if !parent.exists() {
                return Err(format!(
                    "Parent directory does not exist: {}",
                    parent.display()
                ));
            }
        }

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target_path, link)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
        }

        #[cfg(windows)]
        {
            if target_path.is_dir() {
                std::os::windows::fs::symlink_dir(target_path, link).map_err(|e| {
                    if e.raw_os_error() == Some(1314) {
                        "Failed to create symlink: administrator privileges are required. \
                         Enable Developer Mode in Windows Settings or run as administrator."
                            .to_string()
                    } else {
                        format!("Failed to create symlink: {}", e)
                    }
                })?;
            } else {
                std::os::windows::fs::symlink_file(target_path, link).map_err(|e| {
                    if e.raw_os_error() == Some(1314) {
                        "Failed to create symlink: administrator privileges are required. \
                         Enable Developer Mode in Windows Settings or run as administrator."
                            .to_string()
                    } else {
                        format!("Failed to create symlink: {}", e)
                    }
                })?;
            }
        }

        crate::audit_log::log_operation(
            "create_symlink",
            vec![link_path, target],
            None,
            true,
        );

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_file_basic() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("new_file.txt");

        let result = create_file(file_path.to_string_lossy().to_string()).await;

        assert!(
            result.is_ok(),
            "create_file should succeed: {:?}",
            result.err()
        );
        assert!(file_path.exists(), "file should exist after creation");
    }

    #[tokio::test]
    async fn test_create_file_creates_parent_dirs() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("nested").join("deep").join("file.txt");

        let result = create_file(file_path.to_string_lossy().to_string()).await;

        assert!(
            result.is_ok(),
            "create_file with nested dirs should succeed"
        );
        assert!(
            file_path.exists(),
            "file should exist after creation with nested dirs"
        );
    }

    #[tokio::test]
    async fn test_get_file_templates_returns_known_templates() {
        let result = get_file_templates().await;
        assert!(result.is_ok());
        let templates = result.unwrap();
        assert!(!templates.is_empty(), "should have templates");

        let ids: Vec<&str> = templates.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&"html"), "should contain html template");
        assert!(ids.contains(&"python"), "should contain python template");
        assert!(ids.contains(&"json"), "should contain json template");
    }

    #[tokio::test]
    async fn test_create_from_template() {
        let temp = tempdir().expect("Failed to create temp dir");

        let result = create_from_template(
            temp.path().to_string_lossy().to_string(),
            "json".to_string(),
            "data.json".to_string(),
        )
        .await;

        assert!(
            result.is_ok(),
            "create_from_template should succeed: {:?}",
            result.err()
        );
        let created_path = result.unwrap();
        let content = fs::read_to_string(&created_path).unwrap();
        assert!(
            content.contains("{"),
            "JSON template should contain opening brace"
        );
    }

    #[tokio::test]
    async fn test_create_from_template_already_exists_returns_error() {
        let temp = tempdir().expect("Failed to create temp dir");
        let file_path = temp.path().join("data.json");
        File::create(&file_path).unwrap();

        let result = create_from_template(
            temp.path().to_string_lossy().to_string(),
            "json".to_string(),
            "data.json".to_string(),
        )
        .await;

        assert!(result.is_err(), "should fail when file already exists");
        assert!(result.unwrap_err().contains("already exists"));
    }
}
