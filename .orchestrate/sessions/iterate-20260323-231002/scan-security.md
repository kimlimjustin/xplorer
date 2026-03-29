# Security Scan Report -- Xplorer

**Date:** 2026-03-23
**Scanner:** Claude Opus 4.6
**Branch:** `next`
**Scope:** Full codebase -- secrets, input validation, extension sandbox, encryption, Tauri config, data protection, command execution

---

## Summary

| Severity | Count |
|----------|-------|
| P0 (Exploitable)      | 3 |
| P1 (Significant risk) | 5 |
| P2 (Moderate risk)    | 6 |
| P3 (Low / hardening)  | 4 |

---

## P0 -- Exploitable Vulnerabilities

### P0-1: WASM Extension `host_read_file` Has No Path Scoping -- Arbitrary File Read

**File:** `apps/src-tauri/src/extensions/host_functions.rs`, lines 316-331
**Problem:** The `do_read_file` function only calls `validate_file_path` which checks for null bytes and empty strings. It does NOT scope reads to the extension's data directory or any other restricted area. Any WASM extension with the `file:read` permission can read ANY file on the user's filesystem, including `~/.ssh/id_rsa`, `~/.gnupg/`, browser credential stores, etc.

Compare with `do_write_file` (line 333-358) which correctly calls `validate_write_path` to scope writes to the extension data directory. Read operations have no equivalent scoping.

**Impact:** A malicious or compromised extension with `file:read` permission (a common permission) can exfiltrate any file on disk. Combined with `system:network` permission, data can be sent to an attacker's server.

**Severity:** P0
**Effort:** M
**Fix:** Add a `validate_read_path` function that scopes file reads to: (1) the extension's own data directory, (2) the user's currently-open directory in Xplorer, or (3) an explicit allowlist. The same applies to `do_list_dir` and `do_file_exists`.

---

### P0-2: `sanitize_command` Allows Arbitrary Command Execution

**File:** `apps/src-tauri/src/operations/system_ops.rs`, lines 307-344
**Problem:** The `sanitize_command` function blocks shell metacharacters but then allows ANY non-allowlisted command through at line 343: `Ok(())`. The comment says "Non-allowlisted command without metacharacters -- allow through". This means `execute_command("rm -rf /home/user", "/tmp")` passes validation because `rm` without `;|&$` metacharacters is allowed.

The `SAFE_COMMANDS` allowlist is decorative -- it has no effect since both allowlisted and non-allowlisted commands return `Ok(())`.

```rust
// Line 342-343 -- the allowlist is bypassed
// Non-allowlisted command without metacharacters — allow through
Ok(())
```

**Impact:** The frontend (or any code path calling `execute_command`) can execute destructive commands like `rm`, `chmod`, `chown`, `curl`, `wget`, `python`, etc. While `execute_command` is on the `BLOCKED_TAURI_COMMANDS` set for extensions, the Tauri IPC layer itself does not block it -- any compromised frontend JS code can invoke it.

**Severity:** P0
**Effort:** S
**Fix:** Change line 343 from `Ok(())` to `Err(format!("Command '{}' is not on the allowlist", binary_name))`. Alternatively, expand the allowlist to cover all legitimately needed commands and reject everything else.

---

### P0-3: Markdown Preview Extension Uses `dangerouslySetInnerHTML` Without Sanitization

**File:** `packages/extensions/markdown-preview/src/index.tsx`, line 159
**Also:** `apps/src-tauri/data/extensions/xplorer-markdown-preview/src/index.tsx`, line 159
**Problem:** The markdown preview extension renders parsed HTML directly via `dangerouslySetInnerHTML={{ __html: html }}` where `html` comes from `parseMarkdown(text)`. The `parseMarkdown` function does NOT sanitize the output -- it only escapes content inside code blocks (via `escapeHtml`). All other markdown elements (headings, links, images, bold, etc.) pass user content through regex replacements that can be manipulated to inject arbitrary HTML.

For example, the link regex at line 64 creates `<a href="$2">` where `$2` is raw user input from the markdown file. A crafted markdown file like `[click](javascript:alert(1))` would produce a clickable XSS link.

The main app's `MarkdownPreview.tsx` (line 30) correctly uses DOMPurify. The extension does not.

**Impact:** Opening a malicious `.md` file triggers XSS in the extension context. Since extensions have access to `window.XplorerSDK`, this allows file reads/writes, navigation, and potentially `nativeInvoke` if the extension has that permission.

**Severity:** P0
**Effort:** S
**Fix:** Add DOMPurify sanitization to the extension's `parseMarkdown` output before rendering. Or use the `escapeHtml` function on all non-code-block content insertions in the regex chain.

---

## P1 -- Significant Risk

### P1-1: Frontend Extension Sandbox Can Be Bypassed via `import()`

**File:** `apps/client/src/lib/extension-sandbox.ts`, lines 161-401
**Problem:** The sandbox blocks `eval`, `Function`, `fetch`, `XMLHttpRequest`, etc. via parameter shadowing and Proxy interception. However, it does NOT block dynamic `import()`. An extension can call:

```js
import('data:text/javascript,export default window')
```

or reference the unshadowed `globalThis` from a dynamically imported module to escape the sandbox entirely. The `new Function(...)` constructor is shadowed as a parameter, but `import()` is a language-level feature that cannot be overridden by variable shadowing.

Additionally, while `Function.prototype.constructor` is frozen (line 413), `AsyncFunction` and `GeneratorFunction` constructors are not frozen and can be used as escape hatches.

**Impact:** A malicious extension can escape the JS sandbox to access `__TAURI__`, `fetch`, `localStorage`, and all other blocked APIs.

**Severity:** P1
**Effort:** L
**Fix:** The most robust fix is to run extensions in a separate `<iframe>` with `sandbox` attribute and communicate via `postMessage`. The current `new Function()` approach cannot fully contain untrusted JS. As a short-term mitigation, consider using a Content-Security-Policy to block `data:` and `blob:` URLs for scripts.

---

### P1-2: `eject_volume` Command Injection on macOS/Linux

**File:** `apps/src-tauri/src/operations/system_ops.rs`, lines 106-134
**Problem:** The `eject_volume` command passes the user-supplied `path` directly to `diskutil unmount` (macOS) and `umount` (Linux) as a command argument. While these use `arg()` (not shell interpolation), the `path` parameter is not validated for existence as a mount point, nor is it sanitized. On macOS, `diskutil unmount` with a crafted path could have unintended effects.

More critically, on the Windows branch (lines 136-223), the `path` is used to construct a volume path `\\.\\{drive}` and passed to `CreateFileW` with `GENERIC_READ | GENERIC_WRITE` access, potentially opening arbitrary device handles if the path is crafted (e.g., `\\.\PhysicalDrive0`).

**Impact:** A crafted `path` argument could unmount critical volumes or open raw device handles on Windows.

**Severity:** P1
**Effort:** S
**Fix:** Validate that `path` is an actual mount point (e.g., check against `list_drives()` output). On Windows, validate that the path matches a drive letter pattern `X:\` strictly before constructing the device path.

---

### P1-3: WASM `host_http_request` SSRF via DNS Rebinding

**File:** `apps/src-tauri/src/extensions/host_functions.rs`, lines 480-565
**Problem:** The HTTP request flow validates the URL against private IPs at line 497 (`validate_url_security_public`), but then makes the actual HTTP request at line 542. Between validation and request, a DNS rebinding attack can cause the hostname to resolve to a different (private) IP address.

The flow is: validate URL -> create HTTP client -> send request. The DNS resolution happens at request time, not at validation time. An attacker controlling a DNS server can return a public IP during validation, then a private IP (e.g., `169.254.169.254`) during the actual request.

**Impact:** Extensions with `system:network` permission can reach internal services, cloud metadata endpoints (AWS/GCP instance credentials), or localhost services.

**Severity:** P1
**Effort:** M
**Fix:** Resolve the hostname to an IP address FIRST, validate the IP, then make the request using the resolved IP directly (with the original `Host` header). Alternatively, use a custom DNS resolver that validates every resolution against the private IP blocklist.

---

### P1-4: `open_file` on Windows -- Command Injection via Filenames

**File:** `apps/src-tauri/src/operations/system_ops.rs`, lines 379-415
**Problem:** On Windows (lines 388-396), `open_file` uses:
```rust
let quoted_path = format!("\"{}\"", path.to_string_lossy());
std::process::Command::new("cmd")
    .args(["/C", "start", "", &quoted_path])
```

The quoting is insufficient for `cmd.exe /C`. A filename containing `"&calc.exe` would break out of the quotes and execute arbitrary commands. The `cmd /C start "" "path"` pattern is notoriously fragile with special characters in `cmd.exe`.

On macOS (lines 400-403) and Linux (lines 407-411), `arg()` is used directly without shell interpolation, which is safe.

**Impact:** On Windows, a file with a crafted name (e.g., created by syncing from a remote source) could execute arbitrary code when the user double-clicks to open it.

**Severity:** P1
**Effort:** S
**Fix:** On Windows, use `ShellExecuteW` via the `windows` crate instead of `cmd /C start`. This avoids shell interpretation entirely. Alternatively, use `std::process::Command::new("explorer").arg(&path)` which doesn't go through `cmd.exe`.

---

### P1-5: `native_plugin_invoke` Has No Permission Check

**File:** `apps/src-tauri/src/extensions/commands.rs`, lines 659-670
**Problem:** The `native_plugin_invoke` Tauri command does NOT validate that the calling extension has the `native:invoke` permission. The permission check only happens on the frontend in `extension-sandbox.ts` (line 683) and `extension-api-factory.ts` (line 234). Any frontend code (or a sandbox-escaped extension) can directly call the `native_plugin_invoke` Tauri command with any `plugin_id` and `command`.

```rust
#[command]
pub async fn native_plugin_invoke(
    plugin_id: String,
    command: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    // No permission check here!
    tokio::task::spawn_blocking(move || {
        plugin_registry::invoke_plugin(&plugin_id, &command, args)
    })
```

**Impact:** If any extension has a loaded native plugin, any other extension (or compromised frontend code) can invoke that plugin's commands without authorization.

**Severity:** P1
**Effort:** S
**Fix:** Add a backend permission check that validates the `plugin_id` matches the caller's extension ID, or that the caller has `native:invoke` permission. This requires passing the caller's identity to the command.

---

## P2 -- Moderate Risk

### P2-1: Extension Integrity Verification Is Opt-In and Weak

**File:** `apps/client/src/lib/extension-sandbox.ts`, lines 126-147
**Problem:** The `verifyExtensionIntegrity` function returns `{ valid: true, reason: 'no-checksum' }` when no checksum is present (line 132). Extensions without checksums are loaded with only a warning. The Ed25519 signature field exists in the manifest type but is never verified (comment at line 123 says "Full Ed25519 signature verification would require a crypto library; for now we verify the checksum").

**Impact:** Extension supply chain attacks are possible. A compromised or tampered extension bundle will be loaded without any integrity failure. An attacker who can modify extension files on disk or intercept downloads can inject malicious code.

**Severity:** P2
**Effort:** M
**Fix:** (1) Require checksums for all non-builtin extensions. (2) Implement Ed25519 signature verification using WebCrypto or a library. (3) Pin known-good checksums for builtin extensions.

---

### P2-2: Argon2 Default Parameters May Be Insufficient

**File:** `apps/src-tauri/src/operations/encryption_ops.rs`, line 28
**Problem:** `Argon2::default()` is used for key derivation. The default parameters for the `argon2` crate (v0.5) are: Argon2id, m=19456 KiB (19 MB), t=2 iterations, p=1 parallelism. While Argon2id is the correct algorithm choice, 19 MB memory and 2 iterations is on the low end of OWASP's recommendation (minimum 19 MiB, 2 iterations for Argon2id, but 47 MiB+ with 1 iteration or 19 MiB with 3+ iterations preferred for high-value secrets).

For file encryption where the password is the sole protection, stronger parameters are warranted.

**Impact:** Faster offline brute-force attacks against encrypted files. With default parameters on modern hardware, a weak password can be cracked.

**Severity:** P2
**Effort:** S
**Fix:** Explicitly configure Argon2id with stronger parameters:
```rust
let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, Params::new(65536, 3, 1, Some(32)).unwrap());
```
This uses 64 MiB memory and 3 iterations.

---

### P2-3: `api.rs` Mutex Guards Don't Recover from Poison

**File:** `apps/src-tauri/src/api.rs`, lines 8-136 (all `.lock()` calls)
**Problem:** All Mutex lock calls in `api.rs` use `.map_err()` which returns an error but does NOT recover the lock. If any thread panics while holding the `STORAGE` lock, the Mutex becomes permanently poisoned and all subsequent API calls will fail with "Storage lock error".

Other files in the codebase correctly use `.unwrap_or_else(|e| e.into_inner())` as documented in CLAUDE.md.

**Impact:** A single panic in a storage operation permanently breaks all API functionality until the application is restarted.

**Severity:** P2
**Effort:** S
**Fix:** Replace all `.lock().map_err(...)` in `api.rs` with `.lock().unwrap_or_else(|e| e.into_inner())` to recover from poisoned Mutexes, consistent with the rest of the codebase.

---

### P2-4: Extension `isPathAllowed` Check Is Incomplete

**File:** `apps/client/src/lib/extension-host-types.ts`, lines 287-315
**Problem:** The `isPathAllowed` function blocks `..` and certain path prefixes, but:
1. It normalizes with simple string replacement (`\` -> `/` + `toLowerCase`), not proper path resolution.
2. It checks for `/.ssh/` but not `~/.ssh` or `/home/user/.ssh` (the blocklist uses `/` prefix which won't match absolute paths to home directories).
3. The blocked prefixes like `/.ssh/` only match if the path starts with `/.ssh/`, but real paths are `/Users/name/.ssh/`.
4. A path like `/Users/name/.config/google-chrome/Default/Login Data` is not blocked because the prefix check is `/.config/google-chrome/` not `/Users/name/.config/google-chrome/`.

**Impact:** Frontend extensions can request file reads to sensitive locations that the blocklist was intended to protect, because the path normalization doesn't produce the expected format.

**Severity:** P2
**Effort:** S
**Fix:** Use the user's home directory to construct full blocked paths (similar to how `validate_file_path` in `operations/mod.rs` does it). Example: resolve `~/.ssh` to `/Users/kimlim/.ssh` before comparison. Also resolve symlinks.

---

### P2-5: Potential PII Exposure in Audit Log

**File:** `apps/src-tauri/src/audit_log.rs`, lines 134, 181-184, 188-191
**Problem:** The audit log stores full file paths (line 188 `paths: Vec<String>`) and a username from environment (line 181 `whoami()`). Full file paths can contain PII (e.g., `/Users/JohnSmith/Documents/Medical Records/results.pdf`). The audit log also has an export function (`export_csv`) that writes all entries to a CSV file.

Additionally, encryption/decryption operations log the full source and destination paths at `encryption_ops.rs` lines 134, 250.

**Impact:** The audit log CSV export could contain sensitive file path information. If the log file is shared (e.g., for support), PII could be inadvertently disclosed.

**Severity:** P2
**Effort:** S
**Fix:** Hash or truncate file paths in the audit log (keeping just the filename or a hash). Add a warning in the CSV export UI about sensitive data.

---

### P2-6: Extension Permission Model Is Frontend-Only for JS Extensions

**File:** `apps/client/src/lib/extension-sandbox.ts`, lines 54-60, 476-502
**Problem:** Permission checks for JS extensions (e.g., `file:read`, `file:write`, `native:invoke`) are enforced only on the frontend via `hasPermission(manifest, 'permission')`. The Rust backend does not know which extension is making a Tauri invoke call. If an extension escapes the JS sandbox (see P1-1), it can call Tauri commands directly without any permission checks.

WASM extensions have proper backend permission checks via `require_permission` in `host_functions.rs`. JS extensions do not have this.

**Impact:** A sandbox escape gives an extension full access to all Tauri commands regardless of its declared permissions.

**Severity:** P2
**Effort:** L
**Fix:** Implement a backend permission enforcement layer. When an extension makes a Tauri call, include the extension's identity (e.g., via a signed token or session ID) so the Rust backend can validate permissions. This is a significant architectural change.

---

## P3 -- Low Risk / Hardening

### P3-1: Google Drive `client_secret` Partially Visible in Masked Response

**File:** `apps/src-tauri/src/google_drive.rs`, lines 958-960
**Problem:** The `get_gdrive_settings` command masks the `client_secret` by showing the first 4 characters plus `***`. While the keychain stores the full secret, the partial reveal reduces the entropy an attacker needs to brute-force if they can observe the masked value.

**Severity:** P3
**Effort:** S
**Fix:** Replace with a boolean `has_client_secret: true/false` instead of showing partial characters.

---

### P3-2: `fs:read-all` and `fs:write-all` Capabilities Are Overly Broad

**File:** `apps/src-tauri/capabilities/default.json`, lines 27-32
**Problem:** The Tauri capabilities include `fs:read-all` and `fs:write-all` which grant the frontend full filesystem access without path restrictions. While this is expected for a file manager, it means ANY XSS vulnerability in the frontend gives an attacker full filesystem access.

**Severity:** P3
**Effort:** L
**Fix:** This is inherent to the file manager use case. As defense-in-depth, consider using scoped filesystem permissions and requiring explicit user consent for operations on sensitive directories.

---

### P3-3: No Rate Limiting on `execute_command`

**File:** `apps/src-tauri/src/operations/system_ops.rs`, lines 481-500
**Problem:** The `execute_command` Tauri command has no rate limiting. A compromised frontend or extension could rapidly spawn thousands of processes, causing a denial-of-service condition on the host system.

**Severity:** P3
**Effort:** S
**Fix:** Add a token bucket or semaphore to limit concurrent command executions (e.g., max 5 concurrent, max 20 per minute).

---

### P3-4: WASM Fuel Limit Is Static and May Be Insufficient

**File:** `apps/src-tauri/src/extensions/wasm_runtime.rs`, line 33
**Problem:** The fuel limit `CALL_FUEL_LIMIT: u64 = 1_000_000` is hardcoded. For complex WASM extensions, this may be insufficient. For malicious extensions, it may still allow enough computation for cryptomining or other abuse within a single call (the extension can simply be called repeatedly).

**Severity:** P3
**Effort:** S
**Fix:** Make the fuel limit configurable per-extension. Add a global execution time budget per extension (e.g., total CPU-seconds per minute) to prevent abuse across multiple calls.

---

## Items Reviewed and Found Acceptable

1. **Encryption implementation** (`encryption_ops.rs`): AES-256-GCM with Argon2id, random salt/nonce using `rand::thread_rng()` (which delegates to the OS CSPRNG). File layout is correct. Only the default Argon2 parameters are weak (see P2-2).

2. **Secure credential storage** (`secure_credentials.rs`): Uses OS keychain via the `keyring` crate. API keys and refresh tokens are stored in the keychain, not in plaintext JSON files. Migration from plaintext to keychain is handled.

3. **Git exec in WASM** (`host_functions.rs`): Good blocklist of dangerous git flags, shell metacharacter rejection, environment clearing, `GIT_TERMINAL_PROMPT=0`. Write vs. read permission distinction is correct.

4. **ZIP extraction** (`commands.rs`): Properly guards against Zip Slip (path traversal), symlinks, and canonicalizes the target directory.

5. **SSRF validation** (`commands.rs`): Comprehensive checks for private IPs, IPv4-mapped IPv6, link-local, CGNAT, cloud metadata endpoints, decimal/hex-encoded IPs, and internal hostname patterns. Only DNS rebinding is not covered (see P1-3).

6. **Extension ID validation** (`commands.rs`): Thorough character allowlist, `..` rejection, null byte checks, length limits.

7. **DOMPurify usage**: The main app's `MarkdownPreview.tsx` and `DocumentPreview.tsx` both use DOMPurify with strict FORBID_TAGS/FORBID_ATTR configuration.

8. **No hardcoded secrets**: Grep for `password`, `secret`, `key`, `token` found no hardcoded credentials. API keys are stored via OS keychain. `.gitignore` covers `.env` files.

9. **No `eval()` in production frontend code**: No instances found outside of tests and the intentionally blocked sandbox.

10. **.gitignore coverage**: Covers `.env`, `.env.*`, build artifacts, IDE config, and debug logs.
