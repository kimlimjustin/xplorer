use serde_json::{json, Value};

/// Build the list of tool definitions sent to Claude API.
/// Filters out any tools whose name appears in `disabled_tools`.
pub fn build_agent_tools(disabled_tools: &[String]) -> Vec<Value> {
    let mut tools = vec![
        json!({
            "name": "read_file",
            "description": "Read the contents of a file at the given path. Returns the text content.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the file to read" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "list_directory",
            "description": "List all files and directories in a given path. Returns JSON array of entries with name, is_dir, size.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the directory" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "search_files",
            "description": "Search for files matching a glob pattern (e.g. '**/*.txt') within a directory.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Glob pattern to match" },
                    "path": { "type": "string", "description": "Base directory to search in" }
                },
                "required": ["pattern", "path"]
            }
        }),
        json!({
            "name": "search_content",
            "description": "Search file contents for a regex pattern within a directory. Returns matching lines.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Regex pattern to search for" },
                    "path": { "type": "string", "description": "Directory to search in" }
                },
                "required": ["pattern", "path"]
            }
        }),
        json!({
            "name": "get_system_info",
            "description": "Get system information: OS, architecture, hostname, current time.",
            "input_schema": {
                "type": "object",
                "properties": {}
            }
        }),
        json!({
            "name": "write_file",
            "description": "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to write to" },
                    "content": { "type": "string", "description": "Content to write" }
                },
                "required": ["path", "content"]
            }
        }),
        json!({
            "name": "create_directory",
            "description": "Create a directory (and any missing parent directories). Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path of the directory to create" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "rename",
            "description": "Rename a file or directory. Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "old_path": { "type": "string", "description": "Current path" },
                    "new_path": { "type": "string", "description": "New path" }
                },
                "required": ["old_path", "new_path"]
            }
        }),
        json!({
            "name": "delete",
            "description": "Move a file or directory to the system trash/recycle bin. Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to delete (move to trash)" }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "move_file",
            "description": "Move a file or directory to a new location. Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "source": { "type": "string", "description": "Source path" },
                    "destination": { "type": "string", "description": "Destination path" }
                },
                "required": ["source", "destination"]
            }
        }),
        json!({
            "name": "copy_file",
            "description": "Copy a file or directory to a new location. Requires user approval.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "source": { "type": "string", "description": "Source path" },
                    "destination": { "type": "string", "description": "Destination path" }
                },
                "required": ["source", "destination"]
            }
        }),
        json!({
            "name": "execute_command",
            "description": "Execute a shell command. Requires user approval. On Windows uses cmd /C.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "The shell command to execute" },
                    "working_dir": { "type": "string", "description": "Working directory for the command" }
                },
                "required": ["command"]
            }
        }),
        json!({
            "name": "search_indexed",
            "description": "Search the pre-built file index for instant results. Supports natural language queries like 'large pdf files', 'images in downloads', 'python scripts'. Results come from the index and may not reflect very recent changes. Use this FIRST for fast answers, then optionally verify with list_directory or search_files for live data.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query (natural language or keywords)" },
                    "limit": { "type": "integer", "description": "Max results to return (default 20)" }
                },
                "required": ["query"]
            }
        }),
        json!({
            "name": "extract_document_text",
            "description": "Extract text content from document files. Supports: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, RTF. Use this to read and understand the content of office documents and PDFs. Returns the extracted text.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the document file (.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .rtf)" }
                },
                "required": ["path"]
            }
        }),
    ];

    // Planning tools
    tools.push(json!({
        "name": "create_plan",
        "description": "Create an operation plan for complex multi-step tasks. Returns a plan ID. The plan is shown to the user for approval before execution. Use this when a task requires 3+ steps or involves destructive operations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": { "type": "string", "description": "Short title for the plan (e.g. 'Organize Downloads folder')" },
                "description": { "type": "string", "description": "Brief description of the overall goal" },
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": { "type": "string", "description": "The action to perform (e.g. 'create_directory', 'move_file', 'rename')" },
                            "description": { "type": "string", "description": "Human-readable description of this step" },
                            "params": { "type": "object", "description": "Parameters for the action" }
                        },
                        "required": ["action", "description", "params"]
                    },
                    "description": "Ordered list of steps in the plan"
                }
            },
            "required": ["title", "steps"]
        }
    }));

    tools.push(json!({
        "name": "execute_plan",
        "description": "Execute an approved plan by its ID. The plan must be in 'approved' state. Steps are executed in order. If a step fails, execution pauses and the error is reported.",
        "input_schema": {
            "type": "object",
            "properties": {
                "plan_id": { "type": "string", "description": "The plan ID returned by create_plan" }
            },
            "required": ["plan_id"]
        }
    }));

    // Memory tools
    tools.push(json!({
        "name": "remember",
        "description": "Store a piece of information in persistent memory for future conversations. Use this to remember user preferences, directory structures, project conventions, or any useful context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "key": { "type": "string", "description": "A short descriptive key (e.g. 'user_preference_sort_order', 'project_structure')" },
                "value": { "type": "string", "description": "The information to remember" },
                "category": { "type": "string", "enum": ["preference", "knowledge", "context"], "description": "Category of the memory" }
            },
            "required": ["key", "value"]
        }
    }));

    tools.push(json!({
        "name": "recall",
        "description": "Retrieve stored memories. Returns all memories matching the optional category filter, or all memories if no filter is given.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": { "type": "string", "enum": ["preference", "knowledge", "context"], "description": "Optional category filter" },
                "key": { "type": "string", "description": "Optional specific key to retrieve" }
            }
        }
    }));

    // Filter out disabled tools
    if !disabled_tools.is_empty() {
        tools.retain(|t| {
            let name = t["name"].as_str().unwrap_or("");
            !disabled_tools.iter().any(|d| d == name)
        });
    }

    tools
}

/// Returns true if a tool requires user approval before execution.
pub fn tool_requires_approval(name: &str) -> bool {
    matches!(
        name,
        "write_file"
            | "create_directory"
            | "rename"
            | "delete"
            | "move_file"
            | "copy_file"
            | "execute_command"
            | "execute_plan"
    )
}

/// Returns true if a tool is read-only and can be parallelized.
pub fn is_read_only_tool(name: &str) -> bool {
    matches!(
        name,
        "read_file"
            | "list_directory"
            | "search_files"
            | "search_content"
            | "get_system_info"
            | "search_indexed"
            | "extract_document_text"
            | "recall"
    )
}
