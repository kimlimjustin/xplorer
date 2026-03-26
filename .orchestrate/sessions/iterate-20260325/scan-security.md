# Security Scan Report -- 2026-03-25

Scanned after commit e0b4881 (7 P0 fixes already applied). This report covers **remaining** vulnerabilities only.

---

## Finding 1: JS sandbox runs in same realm via `new Function()` -- prototype escape possible

**File:** `apps/client/src/lib/extension-sandbox.ts:194`
**What:** Extensions execute via `new Function(...paramNames, jsContent)` in the main window realm. Despite extensive Proxy-based hardening and prototype freezing in `extension-sandbox-env.ts`, same-realm sandboxes are fundamentally bypassable. Known escape vectors include:
- Async generator / iterator prototype chain: `(async function*(){})().constructor.constructor('return this')()`
- Error stack manipulation to reach native `Function`
- WeakRef / FinalizationRegistry callbacks executing outside proxy scope

The hardening (frozen `constructor` on 6 prototypes, blocked `__proto__`, sandboxed Object/Reflect) is good defense-in-depth but cannot cover all future engine-level escape vectors.

**Severity:** P1
**Effort:** L (requires iframe-based origin isolation or Worker-based sandbox)

---

## Finding 2: `isPathAllowed()` in TypeScript uses string matching without canonicalization

**File:** `apps/client/src/lib/extension-host-types.ts:287-315`
**What:** The function does `path.replace(/\\/g, '/').toLowerCase()` and checks against a blocklist, plus rejects `..`. However, it does **not** resolve symlinks or canonicalize the path. An extension could:
1. Create a symlink at `/tmp/mylink -> /etc/passwd` then read `/tmp/mylink` -- passes all blocklist checks.
2. Use URL-encoded or Unicode-normalized path variants that bypass the lowercase string match.

The Rust-side `validate_file_path` does call `std::fs::canonicalize()` which resolves symlinks, but the JS-side check runs first and is the only gate for extension API calls. An extension with `file:read` permission could read `/etc/shadow` via symlink.

**Severity:** P1
**Effort:** M (add Tauri command to canonicalize path before JS-side check, or move all path validation to Rust side)

---

## Finding 3: Multiple Rust Tauri commands missing `validate_file_path`

**File:** Several in `apps/src-tauri/src/operations/`
**What:** The following `#[command]` functions accept user-supplied paths but do NOT call `validate_file_path`:

| Command | File:Line | Risk |
|---------|-----------|------|
| `open_file` | `system_ops.rs:412` | Executes `open`/`explorer`/`xdg-open` on any path -- could open malicious files |
| `open_in_terminal` | `system_ops.rs:448` | Opens terminal at any directory |
| `show_in_folder` | `system_ops.rs:798` | Reveals any path in file manager |
| `find_files` | `system_ops.rs:736` | Recursively walks any directory |
| `search_in_files` | `system_ops.rs:760` | Reads file contents from any directory |
| `diagnose_directory` | `system_ops.rs:858` | Walks any directory tree |
| `read_directory` | `directory_ops.rs:8` | Lists any directory contents |
| `is_dir` | `directory_ops.rs:68` | Probes existence of any path |
| `get_dir_size` | `directory_ops.rs:111` | Recursively walks any directory |
| `get_file_properties` | `metadata_ops.rs:7` | Reads metadata of any file |
| `eject_volume` | `system_ops.rs:106` | Unmounts volumes (has mount-point check but no `validate_file_path`) |

While some of these are read-only, `open_file` is especially dangerous -- it could launch executables in system directories. The extension API's `BLOCKED_TAURI_COMMANDS` only blocks `execute_command` and `execute_command_stream`; these other commands could be invoked via `nativeInvoke` if the extension has `native:invoke` permission.

**Severity:** P2
**Effort:** S (add `validate_file_path(&path)?;` to each function)

---

## Finding 4: Git API exposed to extensions without `isPathAllowed` checks

**File:** `apps/client/src/lib/extension-api-factory.ts:139-170`
**What:** The entire `git` namespace in the extension API has **zero path validation**. Functions like `findRepository`, `getRepositoryInfo`, `getAllCommits`, `stageFile`, `commitChanges`, `push`, `deleteBranch` take arbitrary `repoPath` parameters with no `isPathAllowed` check and no permission gate. Any extension can:
1. Read git history from any repository on disk
2. Stage, commit, and push changes to any repository
3. Delete branches in any repository

There is also no `validate_file_path` on the Rust side in `git_history.rs`.

**Severity:** P1
**Effort:** M (add `isPathAllowed` + permission checks like `git:read`/`git:write` to all git API methods)

---

## Finding 5: Docker command injection via unsanitized container/image IDs

**File:** `apps/src-tauri/src/operations/docker_ops.rs:101-137`
**What:** Docker commands like `docker_start_container(id)`, `docker_stop_container(id)`, `docker_remove_container(id, force)`, `docker_remove_image(id, force)`, and `docker_container_logs(id, lines)` pass user-supplied `id` strings directly to `StdCommand::new("docker").args(...)`. While `args()` does not invoke a shell (so shell injection is not possible), a malicious extension could pass docker CLI flags as the ID (e.g., `--help` or `--format={{...}}`) to manipulate docker behavior. More critically, there is no validation that the `id` parameter is actually a container/image ID format (hex hash or name).

**Severity:** P3
**Effort:** S (validate ID format: alphanumeric + limited punctuation, reject strings starting with `-`)

---

## Finding 6: CSP allows `blob:` in script-src

**File:** `apps/src-tauri/tauri.conf.json:29`
**What:** The Content Security Policy includes `script-src 'self' blob:`. The `blob:` scheme allows creating JavaScript blobs and executing them as scripts, which could be used by a sandbox-escaping extension to run arbitrary code outside the sandbox's `new Function()` wrapper. This undermines the sandbox defense-in-depth.

**Severity:** P2
**Effort:** S (remove `blob:` from `script-src` if not required, or narrow to specific usage)

---

## Finding 7: Asset protocol scope is overly broad

**File:** `apps/src-tauri/tauri.conf.json:33`
**What:** The asset protocol scope includes `"**"`, `"$HOME/**"`, `"C:/**"`, `"D:/**"`, `"E:/**"`, `"F:/**"`, `"G:/**"` -- effectively the entire filesystem. This means any content loaded via `asset://` protocol can access any file. While this is needed for a file manager's core functionality, it means the CSP's `img-src` / `media-src` allowing `asset:` effectively allows loading any file as an image/media source, which could be used for data exfiltration by a malicious extension via side channels.

**Severity:** P3
**Effort:** M (consider dynamic scope narrowing or runtime path validation for asset protocol requests)

---

## Finding 8: `.gitignore` missing coverage for private key and credential files

**File:** `.gitignore`
**What:** The gitignore covers `.env` and `.env.*` but does NOT cover:
- `*.pem` (TLS/SSH private keys)
- `*.key` (private keys)
- `*.p12` / `*.pfx` (certificate bundles with private keys)
- `credentials.json` (Google OAuth, AWS, etc.)
- `*.keystore` (Java keystores)
- `serviceAccountKey.json` (Firebase/GCP)

The project uses Ed25519 signing keys (`.sig` files are tracked), and Google Drive OAuth integration means credential files could plausibly be created in the repo.

**Severity:** P2
**Effort:** S (add patterns to `.gitignore`)

---

## Finding 9: Extension `database.executeQuery` allows arbitrary SQL via `is_read_only_query` bypass

**File:** `apps/src-tauri/src/operations/database_ops.rs:35-59`
**What:** The `is_read_only_query` check strips leading `--` and `/* */` comments then checks if the remaining text starts with `SELECT`, `PRAGMA`, `EXPLAIN`, or `WITH`. However:
1. `PRAGMA` can be destructive: `PRAGMA journal_mode=OFF`, `PRAGMA secure_delete=ON` change database behavior.
2. `WITH` CTEs can contain `INSERT`/`UPDATE`/`DELETE` in certain SQLite versions (e.g., `WITH cte AS (SELECT 1) INSERT INTO ...`). The test only checks `WITH cte AS (SELECT 1) SELECT * FROM cte` but misses write CTEs.
3. The connection is opened with `SQLITE_OPEN_READ_ONLY`, which is a good backstop, but relying on two independent checks where one is bypassable is a defense-in-depth concern.

Additionally, the extension API at `extension-api-factory.ts:404` calls `executeQuery` gated only on `file:read` -- but PRAGMA could modify database state even on a read-only connection (for in-memory pragmas).

**Severity:** P3
**Effort:** S (restrict allowed prefixes to `SELECT`/`EXPLAIN` only; remove `PRAGMA` and `WITH` from the allowlist or validate them more strictly)

---

## Finding 10: Extension `backend.call` has no permission check

**File:** `apps/client/src/lib/extension-api-factory.ts:566-568`
**What:** The `backend.call` method invokes WASM backend functions with no permission check at all:
```typescript
backend: {
  call: async (method: string, args?: Record<string, unknown>) => {
    return TauriAPI.extensionBackendCall(manifest.id, method, args ?? {});
  },
```
Any extension can call its WASM backend without declaring any permission. The WASM runtime may have its own sandboxing, but the API surface should still require a declared permission (e.g., `backend:call`) so users can see that an extension uses native code.

**Severity:** P2
**Effort:** S (add permission check for `backend:call` or `wasm:execute`)

---

## Finding 11: `sanitize_command` allowlist includes `echo` which enables data exfiltration

**File:** `apps/src-tauri/src/operations/system_ops.rs:324-328`
**What:** The allowlist includes `echo`, `cat`, `head`, `tail`, `grep`, and similar commands. While shell metacharacters are blocked (preventing chaining), an attacker with access to `execute_command` could still:
- `cat /etc/passwd` (read sensitive files -- though `validate_file_path` is NOT called on the path arguments inside commands)
- `grep password /path/to/config` (search for credentials)
- `stat ~/.ssh/id_rsa` (check if SSH keys exist)

The `BLOCKED_TAURI_COMMANDS` set in the extension sandbox correctly blocks `execute_command` from extensions, but this command is still callable from the main frontend. The metacharacter block is good, but the allowed commands can still access sensitive paths because `sanitize_command` does not validate path arguments within the command string.

**Severity:** P3
**Effort:** M (this is inherent to terminal functionality; document the risk; ensure capability restrictions prevent extension access)

---

## Summary

| # | Finding | Severity | Effort | Category |
|---|---------|----------|--------|----------|
| 1 | Same-realm JS sandbox escapable | P1 | L | Sandbox |
| 2 | `isPathAllowed` no canonicalization (symlink bypass) | P1 | M | Path traversal |
| 3 | 11 Rust commands missing `validate_file_path` | P2 | S | Path traversal |
| 4 | Git API has no path/permission checks | P1 | M | Authorization |
| 5 | Docker ops: unsanitized container IDs | P3 | S | Input validation |
| 6 | CSP allows `blob:` in script-src | P2 | S | CSP |
| 7 | Asset protocol scope covers entire filesystem | P3 | M | Data exposure |
| 8 | `.gitignore` missing key/credential patterns | P2 | S | Secret management |
| 9 | SQL `is_read_only_query` allows PRAGMA/WITH writes | P3 | S | SQL injection |
| 10 | `backend.call` has no permission check | P2 | S | Authorization |
| 11 | Terminal allowlist enables sensitive file reads | P3 | M | Data exposure |

**P1 count: 3** | **P2 count: 4** | **P3 count: 4**

### Recommended fix order
1. **Finding 4** (Git API ungated) -- P1, M effort, high impact
2. **Finding 2** (isPathAllowed symlink bypass) -- P1, M effort, enables full path traversal
3. **Finding 3** (Missing validate_file_path) -- P2, S effort, quick wins
4. **Finding 10** (backend.call ungated) -- P2, S effort, quick win
5. **Finding 8** (.gitignore) -- P2, S effort, quick win
6. **Finding 6** (CSP blob:) -- P2, S effort, quick win
7. **Finding 1** (Same-realm sandbox) -- P1, L effort, track as tech debt for iframe migration
