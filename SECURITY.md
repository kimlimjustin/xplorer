# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

Only the latest release on the `next` branch receives security updates.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Email **kimlimjustin@gmail.com** with:

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **48 hours** — initial acknowledgment
- **7 days** — triage and severity assessment
- **30 days** — target for a fix or mitigation (critical issues faster)

## What Counts as a Security Issue

- Extension sandbox escapes (accessing APIs or data outside granted permissions)
- File system access beyond what the user has permitted
- Command injection through file names, paths, or extension inputs
- Cross-site scripting (XSS) in the webview layer
- Privilege escalation via Tauri commands
- Sensitive data exposure (credentials, tokens, file contents leaking to extensions)

## Security Update Process

1. The report is triaged and a severity is assigned (Critical / High / Medium / Low).
2. A fix is developed on a private branch.
3. A new patch release is published with a changelog entry describing the issue at a high level.
4. The reporter is credited (unless they prefer anonymity).

## General Guidance

- Keep your Xplorer installation up to date.
- Review extension permissions before granting access.
- Do not install extensions from untrusted sources.
