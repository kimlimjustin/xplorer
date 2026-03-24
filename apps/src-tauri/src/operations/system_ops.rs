use tauri::command;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct CommandExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(serde::Serialize, Clone)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub path: String,
    pub total_space: u64,
    pub free_space: u64,
}

#[command]
pub async fn list_drives() -> Result<Vec<DriveInfo>, String> {
    #[cfg(windows)]
    {
        let mut drives = Vec::new();
        // Use GetLogicalDrives bitmask
        let bitmask = unsafe { windows_drives_bitmask() };
        for i in 0..26u32 {
            if bitmask & (1 << i) != 0 {
                let letter = (b'A' + i as u8) as char;
                let path = format!("{}:\\", letter);
                let label = get_volume_label(&path).unwrap_or_default();
                let display_label = if label.is_empty() {
                    match letter {
                        'C' => "Local Disk".to_string(),
                        _ => "Local Disk".to_string(),
                    }
                } else {
                    label
                };
                let (total, free) = get_disk_space(std::path::Path::new(&path)).unwrap_or((0, 0));
                drives.push(DriveInfo {
                    letter: letter.to_string(),
                    label: display_label,
                    path,
                    total_space: total,
                    free_space: free,
                });
            }
        }
        Ok(drives)
    }

    #[cfg(target_os = "macos")]
    {
        let mut drives = Vec::new();
        // Root volume
        drives.push(DriveInfo {
            letter: String::new(),
            label: "Macintosh HD".to_string(),
            path: "/".to_string(),
            total_space: 0,
            free_space: 0,
        });
        // List /Volumes for external drives
        if let Ok(entries) = std::fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "Macintosh HD" { continue; }
                let path = entry.path().to_string_lossy().to_string();
                drives.push(DriveInfo {
                    letter: String::new(),
                    label: name,
                    path,
                    total_space: 0,
                    free_space: 0,
                });
            }
        }
        Ok(drives)
    }

    #[cfg(target_os = "linux")]
    {
        let mut drives = Vec::new();
        drives.push(DriveInfo {
            letter: String::new(),
            label: "Root".to_string(),
            path: "/".to_string(),
            total_space: 0,
            free_space: 0,
        });
        Ok(drives)
    }
}

/// Eject / unmount a volume by its mount path.
///
/// - macOS: `diskutil unmount <path>`
/// - Linux: `umount <path>`
/// - Windows: Uses the DeviceIoControl IOCTL_STORAGE_EJECT_MEDIA API
#[command]
pub async fn eject_volume(path: String) -> Result<(), String> {
    // Validate that the path exists
    let mount_path = std::path::Path::new(&path);
    if !mount_path.exists() {
        return Err(format!("Path '{}' does not exist", path));
    }

    // Validate that the path is an actual mount point or drive
    #[cfg(target_os = "macos")]
    {
        if !path.starts_with("/Volumes/") {
            return Err(format!("Path '{}' is not a valid mount point (must be under /Volumes/)", path));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if !path.starts_with("/dev/") && !path.starts_with("/mnt/") && !path.starts_with("/media/") {
            return Err(format!("Path '{}' is not a valid mount point (must be under /dev/, /mnt/, or /media/)", path));
        }
    }

    #[cfg(windows)]
    {
        let path_bytes = path.as_bytes();
        if path_bytes.len() < 2
            || !path_bytes[0].is_ascii_alphabetic()
            || path_bytes[1] != b':'
            || (path_bytes.len() > 2 && path_bytes[2] != b'\\')
        {
            return Err(format!("Path '{}' is not a valid drive (must match drive letter pattern like D:\\)", path));
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("diskutil")
            .arg("unmount")
            .arg(&path)
            .output()
            .map_err(|e| format!("Failed to run diskutil: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("diskutil unmount failed: {}", stderr.trim()))
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("umount")
            .arg(&path)
            .output()
            .map_err(|e| format!("Failed to run umount: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("umount failed: {}", stderr.trim()))
        }
    }

    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use std::iter::once;

        // Derive the drive letter root (e.g. "D:\") from the path
        let root = if path.len() >= 2 && path.as_bytes()[1] == b':' {
            format!("{}:\\", &path[..1])
        } else {
            path.clone()
        };

        // Open the volume with GENERIC_READ | GENERIC_WRITE access
        let volume_path = format!("\\\\.\\{}", root.trim_end_matches('\\'));
        let wide: Vec<u16> = OsStr::new(&volume_path).encode_wide().chain(once(0)).collect();

        #[link(name = "kernel32")]
        extern "system" {
            fn CreateFileW(
                lpFileName: *const u16,
                dwDesiredAccess: u32,
                dwShareMode: u32,
                lpSecurityAttributes: *mut std::ffi::c_void,
                dwCreationDisposition: u32,
                dwFlagsAndAttributes: u32,
                hTemplateFile: *mut std::ffi::c_void,
            ) -> *mut std::ffi::c_void;

            fn DeviceIoControl(
                hDevice: *mut std::ffi::c_void,
                dwIoControlCode: u32,
                lpInBuffer: *mut std::ffi::c_void,
                nInBufferSize: u32,
                lpOutBuffer: *mut std::ffi::c_void,
                nOutBufferSize: u32,
                lpBytesReturned: *mut u32,
                lpOverlapped: *mut std::ffi::c_void,
            ) -> i32;

            fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
        }

        const GENERIC_READ: u32 = 0x80000000;
        const GENERIC_WRITE: u32 = 0x40000000;
        const FILE_SHARE_READ: u32 = 0x00000001;
        const FILE_SHARE_WRITE: u32 = 0x00000002;
        const OPEN_EXISTING: u32 = 3;
        const IOCTL_STORAGE_EJECT_MEDIA: u32 = 0x2D4808;
        const INVALID_HANDLE_VALUE: *mut std::ffi::c_void = usize::MAX as *mut std::ffi::c_void;

        let handle = unsafe {
            CreateFileW(
                wide.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                std::ptr::null_mut(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            )
        };

        if handle == INVALID_HANDLE_VALUE {
            return Err(format!("Failed to open volume handle for '{}'", root));
        }

        let mut bytes_returned: u32 = 0;
        let ok = unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_EJECT_MEDIA,
                std::ptr::null_mut(),
                0,
                std::ptr::null_mut(),
                0,
                &mut bytes_returned,
                std::ptr::null_mut(),
            )
        };
        unsafe { CloseHandle(handle) };

        if ok != 0 {
            Ok(())
        } else {
            Err(format!("Failed to eject volume '{}'", root))
        }
    }
}

#[cfg(windows)]
unsafe fn windows_drives_bitmask() -> u32 {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetLogicalDrives() -> u32;
    }
    GetLogicalDrives()
}

#[cfg(windows)]
fn get_volume_label(root: &str) -> Option<String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::iter::once;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetVolumeInformationW(
            lpRootPathName: *const u16,
            lpVolumeNameBuffer: *mut u16,
            nVolumeNameSize: u32,
            lpVolumeSerialNumber: *mut u32,
            lpMaximumComponentLength: *mut u32,
            lpFileSystemFlags: *mut u32,
            lpFileSystemNameBuffer: *mut u16,
            nFileSystemNameSize: u32,
        ) -> i32;
    }

    let root_wide: Vec<u16> = OsStr::new(root).encode_wide().chain(once(0)).collect();
    let mut name_buf = [0u16; 256];

    let ok = unsafe {
        GetVolumeInformationW(
            root_wide.as_ptr(),
            name_buf.as_mut_ptr(),
            name_buf.len() as u32,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
        )
    };

    if ok != 0 {
        let len = name_buf.iter().position(|&c| c == 0).unwrap_or(name_buf.len());
        let label = String::from_utf16_lossy(&name_buf[..len]);
        if label.is_empty() { None } else { Some(label) }
    } else {
        None
    }
}


#[derive(serde::Serialize)]
pub struct FileSearchMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

/// Allowlist of commands considered safe to run without full path restrictions.
/// NOTE: `env` and `find` were intentionally removed — `env` can execute arbitrary
/// commands (e.g. `env /bin/sh -c …`), and `find` can execute via `-exec`.
const SAFE_COMMANDS: &[&str] = &[
    "ls", "dir", "cat", "head", "tail", "echo", "pwd", "cd", "whoami",
    "hostname", "uname", "date", "which", "where", "type", "grep",
    "wc", "sort", "uniq", "file", "stat", "df", "du", "printenv", "set",
];

/// Shell metacharacters that indicate chaining, piping, or injection.
/// These are ALWAYS rejected, even for allowlisted commands.
const SHELL_METACHARACTERS: &[char] = &[';', '|', '&', '$', '`', '\n', '>', '<'];

/// Validate a command string before passing it to a shell.
///
/// Security invariant: shell metacharacter checks ALWAYS run first,
/// regardless of whether the command is on the allowlist. The allowlist
/// only controls whether a command binary that is not on the list is
/// permitted — it does NOT skip safety checks.
fn sanitize_command(command: &str) -> Result<(), String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Empty command".to_string());
    }

    // Extract the first token (the binary name)
    let first_token = trimmed.split_whitespace().next().unwrap_or("");

    // ── STEP 1: ALWAYS reject shell metacharacters ──────────────────────
    // This check must run unconditionally — even for allowlisted commands
    // — to prevent shell chaining attacks like `ls ; rm -rf /`.
    for &mc in SHELL_METACHARACTERS {
        if trimmed.contains(mc) {
            return Err(format!(
                "Command contains a disallowed shell metacharacter '{}'",
                mc
            ));
        }
    }

    // ── STEP 2: Check the allowlist ─────────────────────────────────────
    // Strip any path prefix so "C:\Windows\system32\whoami" matches "whoami"
    let binary_name = first_token
        .rsplit(|c: char| c == '/' || c == '\\')
        .next()
        .unwrap_or(first_token)
        .to_lowercase();
    // Also strip a trailing .exe on Windows
    let binary_name = binary_name.strip_suffix(".exe").unwrap_or(&binary_name);

    if SAFE_COMMANDS.contains(&binary_name) {
        return Ok(());
    }

    // Non-allowlisted commands are blocked
    Err(format!("Command '{}' is not on the allowlist", binary_name))
}

fn build_shell_command(command: &str) -> std::process::Command {
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", command]);
        return cmd;
    }

    #[cfg(not(windows))]
    {
        let mut cmd = std::process::Command::new("sh");
        cmd.args(["-c", command]);
        return cmd;
    }
}

fn walk_files(root: &PathBuf, out: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = std::fs::read_dir(root)
        .map_err(|e| format!("Failed to read directory {}: {}", root.display(), e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            out.push(path.clone());
            walk_files(&path, out)?;
        } else if path.is_file() {
            out.push(path);
        }
    }
    Ok(())
}

#[command]
pub async fn open_file(path: String) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    // Use the OS default application to open the file
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

#[command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }
    
    let dir_path = if path.is_dir() {
        path
    } else {
        path.parent().unwrap_or(path)
    };
    
    #[cfg(windows)]
    {
        // Use quoted path to prevent command injection via directory names containing shell metacharacters
        let quoted_dir = format!("\"{}\"", dir_path.to_string_lossy());
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", "cd", "/D", &quoted_dir])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &dir_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try different terminal emulators      
        let terminals = ["gnome-terminal", "konsole", "xterm", "alacritty", "kitty"];
        let mut success = false;
        
        for terminal in &terminals {
            if let Ok(_) = std::process::Command::new(terminal)
                .arg("--working-directory")   
                .arg(&dir_path)
                .spawn()
            {
                success = true;
                break;
            }
        }
        
        if !success {
            return Err("No suitable terminal emulator found".to_string());
        }
    }
    
    Ok(())
}

// Security consideration: This command is intentionally unrestricted because it backs
// the integrated terminal feature (execute_command_stream), which requires full shell
// access including pipes, chaining, and subshells. Access control should be enforced
// at the Tauri permission layer (capabilities) to restrict which frontends can invoke
// this command. Do NOT expose this to untrusted or sandboxed extension contexts.
#[command]
pub async fn execute_command(command: String, working_dir: String) -> Result<CommandExecutionResult, String> {
    let working_dir_path = std::path::Path::new(&working_dir);
    if !working_dir_path.exists() || !working_dir_path.is_dir() {
        return Err("Working directory does not exist or is not a directory".to_string());
    }

    // Validate command against allowlist / metacharacter rules
    sanitize_command(&command)?;

    let output = build_shell_command(&command)
        .current_dir(working_dir_path)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(CommandExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[command]
pub async fn execute_command_stream(
    app_handle: tauri::AppHandle,
    command: String,
    working_dir: String
) -> Result<(), String> {
    let result = execute_command(command, working_dir).await?;
    if !result.stdout.is_empty() {
        app_handle
            .emit("terminal-output", result.stdout)
            .map_err(|e| format!("Failed to emit terminal output: {}", e))?;
    }
    if !result.stderr.is_empty() {
        app_handle
            .emit("terminal-output", result.stderr)
            .map_err(|e| format!("Failed to emit terminal output: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── sanitize_command tests ──────────────────────────────────────────

    #[test]
    fn test_sanitize_allows_whitelisted_commands() {
        assert!(sanitize_command("ls -la").is_ok());
        assert!(sanitize_command("dir").is_ok());
        assert!(sanitize_command("cat file.txt").is_ok());
        assert!(sanitize_command("head -n 10 file.txt").is_ok());
        assert!(sanitize_command("echo hello").is_ok());
        assert!(sanitize_command("pwd").is_ok());
        assert!(sanitize_command("whoami").is_ok());
        assert!(sanitize_command("grep pattern file").is_ok());
        assert!(sanitize_command("wc -l file.txt").is_ok());
        assert!(sanitize_command("sort data.csv").is_ok());
        assert!(sanitize_command("uniq lines.txt").is_ok());
        assert!(sanitize_command("file document.pdf").is_ok());
        assert!(sanitize_command("stat info.txt").is_ok());
        assert!(sanitize_command("df -h").is_ok());
        assert!(sanitize_command("du -sh .").is_ok());
        assert!(sanitize_command("printenv HOME").is_ok());
        assert!(sanitize_command("hostname").is_ok());
        assert!(sanitize_command("uname -a").is_ok());
        assert!(sanitize_command("date").is_ok());
        assert!(sanitize_command("which python").is_ok());
        assert!(sanitize_command("where cmd").is_ok());
        assert!(sanitize_command("type bash").is_ok());
        assert!(sanitize_command("tail -f log.txt").is_ok());
        assert!(sanitize_command("set").is_ok());
    }

    #[test]
    fn test_sanitize_rejects_shell_metacharacters_on_unknown_commands() {
        // Non-whitelisted commands with metacharacters should be rejected
        assert!(sanitize_command("unknown_cmd ; rm -rf /").is_err());
        assert!(sanitize_command("unknown_cmd | cat /etc/passwd").is_err());
        assert!(sanitize_command("unknown_cmd & background").is_err());
        assert!(sanitize_command("unknown_cmd $(whoami)").is_err());
        assert!(sanitize_command("unknown_cmd `whoami`").is_err());
        assert!(sanitize_command("unknown_cmd > output.txt").is_err());
        assert!(sanitize_command("unknown_cmd < input.txt").is_err());
        assert!(sanitize_command("unknown_cmd\necho pwned").is_err());
    }

    #[test]
    fn test_sanitize_rejects_metacharacters_even_for_allowlisted_commands() {
        // MED-01 fix: metacharacter checks ALWAYS run, even for allowlisted commands.
        // This prevents shell chaining attacks like `ls ; rm -rf /`.
        assert!(sanitize_command("echo hello | grep h").is_err());
        assert!(sanitize_command("ls > output.txt").is_err());
        assert!(sanitize_command("cat file.txt | head").is_err());
        assert!(sanitize_command("grep pattern ; echo done").is_err());
        assert!(sanitize_command("echo $(date)").is_err());
        assert!(sanitize_command("ls && rm -rf /").is_err());
        assert!(sanitize_command("cat file.txt `rm -rf /`").is_err());
        assert!(sanitize_command("echo hello\nrm -rf /").is_err());
    }

    #[test]
    fn test_sanitize_rejects_empty_command() {
        assert!(sanitize_command("").is_err());
        assert!(sanitize_command("   ").is_err());
    }

    #[test]
    fn test_sanitize_allows_non_whitelisted_command_without_metacharacters() {
        // A non-whitelisted command with no metacharacters should pass
        assert!(sanitize_command("mycustomtool --version").is_ok());
        assert!(sanitize_command("cargo build").is_ok());
        assert!(sanitize_command("npm install").is_ok());
    }

    #[test]
    fn test_sanitize_strips_path_prefix_from_binary_name() {
        // Even if the whitelisted command is given with a full path
        assert!(sanitize_command("/usr/bin/ls -la").is_ok());
        assert!(sanitize_command("/bin/cat file.txt").is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn test_sanitize_strips_exe_suffix_on_windows() {
        assert!(sanitize_command("whoami.exe").is_ok());
        assert!(sanitize_command("C:\\Windows\\System32\\whoami.exe").is_ok());
    }

    #[test]
    fn test_sanitize_rejects_dollar_sign_in_unknown_command() {
        assert!(sanitize_command("custom_tool $HOME").is_err());
    }

    #[test]
    fn test_sanitize_env_and_find_removed_from_allowlist() {
        // S-8 fix: `env` and `find` were removed from the safe command allowlist
        // because they can be abused for arbitrary command execution.
        //
        // Without metacharacters they still pass through (needed for terminal),
        // but the critical fix is that they can no longer bypass metacharacter
        // checks. Previously, `find . -exec rm {} ; echo pwned` would pass
        // because `find` was on the allowlist and the allowlist skipped ALL
        // metacharacter checks. Now the semicolon is always caught.
        assert!(sanitize_command("find . -name test").is_ok()); // safe args, no metacharacters
        assert!(sanitize_command("env HOME=/tmp myapp").is_ok()); // no metacharacters

        // Shell chaining via find/env is now blocked:
        assert!(sanitize_command("find . -exec rm {} ;").is_err()); // contains ';'
        assert!(sanitize_command("find . -name '*.txt' | xargs rm").is_err()); // contains '|'
        assert!(sanitize_command("env VAR=val sh -c 'cmd' && evil").is_err()); // contains '&'
        assert!(sanitize_command("env $SHELL").is_err()); // contains '$'
    }

    // ─── walk_files tests ────────────────────────────────────────────────

    #[test]
    fn test_walk_files_collects_files_recursively() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let root = temp.path();

        // Create nested directory structure
        std::fs::create_dir_all(root.join("a/b")).unwrap();
        std::fs::write(root.join("top.txt"), "top").unwrap();
        std::fs::write(root.join("a/mid.txt"), "mid").unwrap();
        std::fs::write(root.join("a/b/deep.txt"), "deep").unwrap();

        let mut files = Vec::new();
        walk_files(&root.to_path_buf(), &mut files).unwrap();

        assert_eq!(files.len(), 3, "should find all 3 files");
        let names: Vec<String> = files
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"top.txt".to_string()));
        assert!(names.contains(&"mid.txt".to_string()));
        assert!(names.contains(&"deep.txt".to_string()));
    }

    #[test]
    fn test_walk_files_empty_directory() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let mut files = Vec::new();
        walk_files(&temp.path().to_path_buf(), &mut files).unwrap();
        assert!(files.is_empty());
    }

    #[test]
    fn test_walk_files_nonexistent_dir_returns_error() {
        let fake = std::path::PathBuf::from("/nonexistent_test_dir_12345");
        let mut files = Vec::new();
        let result = walk_files(&fake, &mut files);
        assert!(result.is_err());
    }

    // ─── build_shell_command tests ───────────────────────────────────────

    #[test]
    fn test_build_shell_command_returns_command() {
        let cmd = build_shell_command("echo hello");
        // Just verify it doesn't panic; the returned Command is opaque
        // but we can check the program
        let program = cmd.get_program().to_string_lossy().to_string();
        #[cfg(windows)]
        assert!(program.contains("cmd"), "should use cmd on Windows");
        #[cfg(not(windows))]
        assert!(program.contains("sh"), "should use sh on non-Windows");
    }
}

#[command]
pub async fn get_current_shell() -> Result<String, String> {
    #[cfg(windows)]
    {
        Ok(std::env::var("COMSPEC").unwrap_or_else(|_| "cmd".to_string()))
    }
    #[cfg(not(windows))]
    {
        Ok(std::env::var("SHELL").unwrap_or_else(|_| "sh".to_string()))
    }
}

#[command]
pub async fn find_files(pattern: String, search_path: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(search_path);
    if !root.exists() || !root.is_dir() {
        return Err("Search path does not exist or is not a directory".to_string());
    }

    let mut files = Vec::new();
    walk_files(&root, &mut files)?;

    let pattern_lower = pattern.to_lowercase();
    Ok(files
        .into_iter()
        .filter_map(|p| {
            let name = p.file_name()?.to_string_lossy().to_lowercase();
            if name.contains(&pattern_lower) {
                Some(p.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect())
}

#[command]
pub async fn search_in_files(pattern: String, search_path: String) -> Result<Vec<FileSearchMatch>, String> {
    let root = PathBuf::from(search_path);
    if !root.exists() || !root.is_dir() {
        return Err("Search path does not exist or is not a directory".to_string());
    }

    let mut files = Vec::new();
    walk_files(&root, &mut files)?;

    let pattern_lower = pattern.to_lowercase();
    let mut matches = Vec::new();

    for file_path in files {
        let Ok(metadata) = std::fs::metadata(&file_path) else { continue };
        if metadata.len() > 1_000_000 {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&file_path) else { continue };
        for (index, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&pattern_lower) {
                matches.push(FileSearchMatch {
                    file: file_path.to_string_lossy().to_string(),
                    line: index + 1,
                    content: line.to_string(),
                });
            }
        }
    }

    Ok(matches)
}

#[command]
pub async fn get_app_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}

#[command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(windows)]
    {
        let mut args = vec!["/select,".to_string()];
        args[0].push_str(&path.to_string_lossy());
        std::process::Command::new("explorer")
            .arg(args[0].as_str())
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let dir = if path.is_dir() {
            path.to_path_buf()
        } else {
            path.parent().unwrap_or(path).to_path_buf()
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    Ok(())
}

// ─── Directory Diagnostics ──────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
pub struct DirectoryProblem {
    pub path: String,
    pub name: String,
    pub severity: String,  // "error", "warning", "info"
    pub category: String,  // "empty", "large", "broken", "naming", "permission", "junk"
    pub message: String,
    pub size: Option<u64>,
}

#[derive(serde::Serialize, Clone)]
pub struct DiagnosisResult {
    pub problems: Vec<DirectoryProblem>,
    pub scanned_files: u64,
    pub scanned_dirs: u64,
}

#[command]
pub async fn diagnose_directory(path: String, skip_hidden: Option<bool>, skip_gitignored: Option<bool>) -> Result<DiagnosisResult, String> {
    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    let skip_hidden = skip_hidden.unwrap_or(true);
    let skip_gitignored = skip_gitignored.unwrap_or(true);

    let result = tokio::task::spawn_blocking(move || {
        let mut problems: Vec<DirectoryProblem> = Vec::new();
        let mut scanned_files: u64 = 0;
        let mut scanned_dirs: u64 = 0;

        // Track names for case-collision detection
        let mut seen_names: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        let junk_files: std::collections::HashSet<&str> = [
            "thumbs.db", "desktop.ini", ".ds_store",
            ".spotlight-v100", ".trashes",
            ".fseventsd", "pagefile.sys", "hiberfil.sys", "swapfile.sys",
        ].iter().copied().collect();

        let junk_extensions: std::collections::HashSet<&str> = [
            "tmp", "temp", "bak", "old", "orig", "swp", "swo",
        ].iter().copied().collect();

        // Use the `ignore` crate walker — respects .gitignore and hidden files
        let walker = ignore::WalkBuilder::new(&path)
            .max_depth(Some(5))
            .follow_links(false)
            .hidden(skip_hidden)           // skip hidden files/dirs by default
            .git_ignore(skip_gitignored)   // respect .gitignore by default
            .git_global(skip_gitignored)
            .git_exclude(skip_gitignored)
            .build();

        for entry_result in walker {
            let entry = match entry_result {
                Ok(e) => e,
                Err(err) => {
                    let msg = format!("{}", err);
                    problems.push(DirectoryProblem {
                        path: msg.clone(),
                        name: msg,
                        severity: "error".to_string(),
                        category: "permission".to_string(),
                        message: format!("Access error: {}", err),
                        size: None,
                    });
                    continue;
                }
            };

            if entry.depth() == 0 {
                continue;
            }

            let entry_path = entry.path();
            let p = entry_path.to_string_lossy().to_string();
            let name = entry_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let ft = match entry.file_type() {
                Some(ft) => ft,
                None => continue,
            };

            // Broken symlinks
            if ft.is_symlink() {
                if !entry_path.exists() {
                    problems.push(DirectoryProblem {
                        path: p, name,
                        severity: "error".to_string(),
                        category: "broken".to_string(),
                        message: "Broken symlink — target does not exist".to_string(),
                        size: None,
                    });
                }
                continue;
            }

            if ft.is_dir() {
                scanned_dirs += 1;

                // Empty directories
                if let Ok(mut rd) = std::fs::read_dir(entry_path) {
                    if rd.next().is_none() {
                        problems.push(DirectoryProblem {
                            path: p.clone(), name: name.clone(),
                            severity: "info".to_string(),
                            category: "empty".to_string(),
                            message: "Empty directory".to_string(),
                            size: None,
                        });
                    }
                }

                // Case collision for dirs
                let name_lower = name.to_lowercase();
                if let Some(existing) = seen_names.get(&name_lower) {
                    if existing != &name {
                        problems.push(DirectoryProblem {
                            path: p, name: name.clone(),
                            severity: "warning".to_string(),
                            category: "naming".to_string(),
                            message: format!("Name collision (case-insensitive): \"{}\" vs \"{}\"", name, existing),
                            size: None,
                        });
                    }
                } else {
                    seen_names.insert(name_lower, name);
                }
                continue;
            }

            // File
            scanned_files += 1;
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size = metadata.len();

            // Empty files
            if size == 0 {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "info".to_string(),
                    category: "empty".to_string(),
                    message: "Empty file (0 bytes)".to_string(),
                    size: Some(0),
                });
            }

            // Very large files (>500MB)
            if size > 500 * 1024 * 1024 {
                let size_mb = size / (1024 * 1024);
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "warning".to_string(),
                    category: "large".to_string(),
                    message: format!("Very large file ({} MB)", size_mb),
                    size: Some(size),
                });
            }

            // Junk/temporary files
            let name_lower = name.to_lowercase();
            let is_junk = junk_files.contains(name_lower.as_str());
            let ext_lower = entry_path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            let is_junk_ext = junk_extensions.contains(ext_lower.as_str());

            if is_junk || is_junk_ext {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "info".to_string(),
                    category: "junk".to_string(),
                    message: if is_junk {
                        "System/junk file".to_string()
                    } else {
                        format!("Temporary/backup file (.{})", ext_lower)
                    },
                    size: Some(size),
                });
            }

            // Long file names (>200 chars)
            if name.len() > 200 {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "warning".to_string(),
                    category: "naming".to_string(),
                    message: format!("Very long filename ({} chars)", name.len()),
                    size: Some(size),
                });
            }

            // Special characters in filename
            let has_special = name.chars().any(|c| {
                matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*')
                || (c as u32) < 32
            });
            if has_special {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "warning".to_string(),
                    category: "naming".to_string(),
                    message: "Filename contains special characters that may cause issues".to_string(),
                    size: Some(size),
                });
            }

            // ── Filename grammar / style checks ──
            let stem = entry_path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            // Leading or trailing spaces/dots
            if name != name.trim() || stem.ends_with('.') || stem.starts_with('.') && stem.len() > 1 && stem.chars().nth(1).map_or(false, |c| c == ' ') {
                if name != name.trim() {
                    problems.push(DirectoryProblem {
                        path: p.clone(), name: name.clone(),
                        severity: "warning".to_string(),
                        category: "naming".to_string(),
                        message: "Filename has leading or trailing spaces".to_string(),
                        size: Some(size),
                    });
                }
            }

            // Consecutive spaces
            if name.contains("  ") {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "info".to_string(),
                    category: "naming".to_string(),
                    message: "Filename contains consecutive spaces".to_string(),
                    size: Some(size),
                });
            }

            // Mixed separators (both hyphens and underscores in same stem)
            if stem.contains('-') && stem.contains('_') {
                problems.push(DirectoryProblem {
                    path: p.clone(), name: name.clone(),
                    severity: "info".to_string(),
                    category: "naming".to_string(),
                    message: "Mixed separators (both - and _ in filename)".to_string(),
                    size: Some(size),
                });
            }

            // Inconsistent casing — MiXeD CaSe (has uppercase in the middle after lowercase)
            {
                let chars: Vec<char> = stem.chars().collect();
                let mut saw_lower = false;
                let mut has_upper_after_lower = false;
                for ch in &chars {
                    if ch.is_lowercase() {
                        saw_lower = true;
                    } else if ch.is_uppercase() && saw_lower {
                        has_upper_after_lower = true;
                        break;
                    }
                }
                // Only flag if it also has spaces (e.g. "My file Name.txt")
                // camelCase/PascalCase in code files is normal, so only flag if spaces present
                if has_upper_after_lower && stem.contains(' ') {
                    problems.push(DirectoryProblem {
                        path: p.clone(), name: name.clone(),
                        severity: "info".to_string(),
                        category: "naming".to_string(),
                        message: "Inconsistent casing in filename".to_string(),
                        size: Some(size),
                    });
                }
            }

            // Double extensions (e.g. "file.tar.gz.bak", "report.pdf.tmp")
            // Count dots in the name; flag if 3+ parts (2+ dots beyond the main extension)
            {
                let dot_count = name.chars().filter(|&c| c == '.').count();
                if dot_count >= 3 {
                    problems.push(DirectoryProblem {
                        path: p.clone(), name: name.clone(),
                        severity: "info".to_string(),
                        category: "naming".to_string(),
                        message: format!("Multiple extensions ({} dots in filename)", dot_count),
                        size: Some(size),
                    });
                }
            }

            // Copy-style names: "file (1).txt", "file - Copy.txt", "file copy 2.txt"
            {
                let stem_lower = stem.to_lowercase();
                let is_copy_pattern =
                    // "file (1)", "file (2)", etc.
                    stem.ends_with(')') && stem.contains(" (") && {
                        let inner = stem.rsplit(" (").next().unwrap_or("");
                        let inner = &inner[..inner.len().saturating_sub(1)];
                        inner.chars().all(|c| c.is_ascii_digit())
                    }
                    // "file - Copy", "file - Copy (2)"
                    || stem_lower.contains(" - copy")
                    // "file copy", "file copy 2"
                    || stem_lower.ends_with(" copy")
                    || stem_lower.contains(" copy ");
                if is_copy_pattern {
                    problems.push(DirectoryProblem {
                        path: p.clone(), name: name.clone(),
                        severity: "info".to_string(),
                        category: "naming".to_string(),
                        message: "Looks like a duplicate/copy filename".to_string(),
                        size: Some(size),
                    });
                }
            }

            // Case collision for files
            if let Some(existing) = seen_names.get(&name_lower) {
                if existing != &name {
                    problems.push(DirectoryProblem {
                        path: p, name: name.clone(),
                        severity: "warning".to_string(),
                        category: "naming".to_string(),
                        message: format!("Name collision (case-insensitive): \"{}\" vs \"{}\"", name, existing),
                        size: Some(size),
                    });
                }
            } else {
                seen_names.insert(name_lower, name);
            }
        }

        // Sort: errors first, then warnings, then info
        problems.sort_by(|a, b| {
            let severity_order = |s: &str| match s {
                "error" => 0,
                "warning" => 1,
                "info" => 2,
                _ => 3,
            };
            severity_order(&a.severity).cmp(&severity_order(&b.severity))
        });

        DiagnosisResult {
            problems,
            scanned_files,
            scanned_dirs,
        }
    })
    .await
    .map_err(|e| format!("Diagnosis task failed: {}", e))?;

    Ok(result)
}
