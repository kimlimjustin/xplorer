// ── Git argument sanitization helpers (S-9) ─────────────────────────────────

/// Validate a git ref name (branch, tag, commit hash) to prevent flag injection.
/// Rejects values that start with `-` (which git would interpret as flags)
/// and values containing shell metacharacters or suspicious patterns.
pub(crate) fn validate_git_ref(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    if value.starts_with('-') {
        return Err(format!(
            "{} '{}' looks like a flag \u{2014} rejecting to prevent injection",
            label, value
        ));
    }
    // Reject shell metacharacters that should never appear in a git ref
    const FORBIDDEN: &[char] = &[
        ';', '|', '&', '$', '`', '\n', '\r', '\0', '>', '<', '\'', '"',
    ];
    for &ch in FORBIDDEN {
        if value.contains(ch) {
            return Err(format!("{} contains forbidden character '{}'", label, ch));
        }
    }
    // Reject ".." to prevent ref traversal (e.g. "../../etc/passwd")
    if value.contains("..") {
        return Err(format!(
            "{} contains '..' \u{2014} rejecting to prevent traversal",
            label
        ));
    }
    Ok(())
}

/// Validate a file path argument for git commands.
/// The path itself will be passed after a `--` separator, but we still
/// reject obviously malicious values.
pub(crate) fn validate_git_path(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    if value.starts_with('-') {
        return Err(format!(
            "{} '{}' looks like a flag \u{2014} rejecting to prevent injection",
            label, value
        ));
    }
    // Reject null bytes which could truncate the argument
    if value.contains('\0') {
        return Err(format!("{} contains null byte", label));
    }
    Ok(())
}
