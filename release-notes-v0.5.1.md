# OpenTerm v0.5.1 Release Notes

OpenTerm v0.5.1 is a critical security maintenance release addressing five security vulnerabilities across command execution, remote SSH verification, and local filesystem access boundaries (Closes #7).

## Security Fixes

### 1. Safe Protocol Handler Execution (`open_url`)
- **Vulnerability**: Potential command injection via unescaped URLs on Windows.
- **Resolution**: Enforced strict `http://` and `https://` scheme validation, rejected control characters and quoting delimiters (`"`, `'`, `` ` ``), and switched Windows execution from shell invocation (`cmd /C start`) to `rundll32 url.dll,FileProtocolHandler`.

### 2. Strict Local Path Boundary Enforcement (`sftp_download`, `sftp_upload`)
- **Vulnerability**: Arbitrary local file read and write access via unvalidated IPC parameters.
- **Resolution**: Implemented comprehensive path validation (`validate_local_path`). Automatically canonicalizes targets, strips traversal sequences, forbids null bytes, and strictly denies access to credential stores (`.ssh`, `.gnupg`, `.aws`, `.azure`, `.kube`), private keys (`id_rsa*`, `id_ed25519*`, etc.), shell initialization profiles (`.bashrc`, `.zshrc`, etc.), Windows Startup directories, and OS system directories.

### 3. Local Directory Enumeration Restrictions (`local_list_dir`)
- **Vulnerability**: Unrestricted local filesystem browsing exposing sensitive credential files.
- **Resolution**: Restricted directory listing via `validate_local_path`. Credential folders (`.ssh`, `.gnupg`, etc.) and private key files are automatically filtered out from directory listing results and blocked from navigation.

### 4. Symlink Traversal Prevention in Recursive SFTP Uploads
- **Vulnerability**: Recursive upload following symbolic links could exfiltrate target symlinked system files or directories.
- **Resolution**: Evaluated local file types using metadata without following symlinks (`entry.file_type()`), explicitly skipping symbolic links during recursive directory traversal.

### 5. SSH Host Key Verification & MITM Protection
- **Vulnerability**: Missing remote host key validation in SSH and SFTP connections allowing potential man-in-the-middle attacks.
- **Resolution**: Implemented host key checks against `~/.ssh/known_hosts` for both terminal and SFTP connections. Uses Trust-On-First-Use (TOFU) to record previously unseen valid hosts, and immediately aborts connections with a security alert on key mismatch.

---

## Verification & Stability
- 23/23 Cargo unit and integration tests passing.
- 33/33 Vitest tests passing.
