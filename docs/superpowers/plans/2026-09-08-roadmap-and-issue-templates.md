# OpenTerm v0.5.0+ Implementation Plan: Issue Templates & Feature Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish GitHub issue templates + documentation, followed by implementing 7 core workflow & security enhancements (Remote Editor, Transfer Conflicts, Multi-Session Tabs, SFTP Context Menu, Resizable Panes, Encrypted Credentials, and Authenticator App Lock).

**Architecture:** 
1. Community templates: GitHub YAML forms (`.github/ISSUE_TEMPLATE/`) + README issue reporting section.
2. Frontend: React 19 + Zustand + TanStack Virtualizer + Tailwind CSS + Lucide icons.
3. Backend: Tauri 2 + Rust (`ssh2`, `ssh-key`, `ring`/`aes-gcm`, `totp-rs`). Zero binary in JavaScript rule strictly preserved.

**Tech Stack:** TypeScript, React 19, Tailwind CSS, Vite, Vitest, Rust, Tauri 2, `ssh2`, `ssh-key`.

---

## Global Constraints
- Zero binary data in JavaScript: all SFTP payload transfers stay disk-to-socket in Rust.
- Footprint target: 80MB - 150MB active RAM usage.
- Cross-platform paths: always use `getBasename`, `joinLocalPath`, and `joinRemotePath` from `src/utils/pathUtils.ts`.
- Sensitive data policy: private keys and passwords must never be stored in plain text.

---

## Phase 0: GitHub Issue Templates & Contribution Guide (Immediate Deliverable)

### Task 0.1: GitHub Bug Report Form Template

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`

- [ ] **Step 1: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

```yaml
name: "🐛 Bug Report"
description: "File a bug report to help us improve OpenTerm"
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report an issue! Please ensure you are running the latest version of OpenTerm.
  - type: input
    id: version
    attributes:
      label: OpenTerm Version
      description: What version of OpenTerm are you running? (e.g. v0.4.0)
      placeholder: v0.4.0
    validations:
      required: true
  - type: dropdown
    id: os
    attributes:
      label: Operating System
      description: What operating system are you using?
      options:
        - Windows 11
        - Windows 10
        - macOS (Apple Silicon)
        - macOS (Intel)
        - Linux (Ubuntu / Debian)
        - Linux (Arch / Fedora)
        - Other
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear and concise description of what the bug is.
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to Reproduce
      description: Detailed steps explaining how to reproduce the issue.
      placeholder: |
        1. Go to '...'
        2. Click on '....'
        3. See error
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected vs Actual Behavior
      description: What did you expect to happen versus what actually happened?
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs / Error Output
      description: Paste any console logs, terminal output, or screenshot links (DO NOT paste private keys or passwords!).
      render: shell
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.yml
git commit -m "docs: add GitHub bug report issue template"
```

---

### Task 0.2: GitHub Feature Request Form Template

**Files:**
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`

- [ ] **Step 1: Create `.github/ISSUE_TEMPLATE/feature_request.yml`**

```yaml
name: "💡 Feature Request"
description: "Suggest an idea or enhancement for OpenTerm"
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting an improvement for OpenTerm!
  - type: textarea
    id: problem
    attributes:
      label: Is your feature request related to a problem?
      description: A clear and concise description of what the problem or limitation is.
      placeholder: "I'm always frustrated when..."
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Describe the solution you'd like
      description: A clear and concise description of what you want to happen.
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Describe alternatives you've considered
      description: Any alternative solutions or features you've evaluated.
  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Add any other context, screenshots, or mockups about the feature request here.
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/feature_request.yml
git commit -m "docs: add GitHub feature request template"
```

---

### Task 0.3: GitHub Template Chooser Configuration

**Files:**
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
contact_links:
  - name: GitHub Discussions
    url: https://github.com/rzkfyn/openterm/discussions
    about: Ask questions, share ideas, and discuss OpenTerm with the community.
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/config.yml
git commit -m "docs: configure GitHub issue template chooser"
```

---

### Task 0.4: Update README with Reporting Guidelines

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add "Reporting Issues & Feedback" section to `README.md`**
Include:
- Direct links to bug report and feature request templates.
- Guidelines: check existing issues, do not share credentials/private keys, include OS & version.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add issue reporting guidelines and template links to README"
```

---

## Phase 1: Remote File Editor & Context Menu (Ideas #1 & #4)

### Task 1.1: SFTP File Operations in Rust Backend
- Add commands: `sftp_rename`, `sftp_delete`, `sftp_mkdir`, `sftp_touch`, `sftp_chmod`.
- Unit tests for remote path sanity checks.

### Task 1.2: SFTP Right-Click Context Menu in Frontend
- Right-click on file/folder: Rename, Delete, Edit, Download/Upload, Permissions (`chmod`).
- Keyboard shortcuts: `F2` rename, `Delete` delete.

### Task 1.3: Remote File Editor Integration (Built-in + External like VS Code)
- Lightweight built-in modal editor for `.txt`, `.env`, `.json`, `.yaml`, `.sh`, `.conf`.
- Settings option for external editor: e.g. `code --wait`, `notepad.exe`.
- Temp file download -> file watcher (`notify` in Rust) -> auto-upload back over SFTP on save.

---

## Phase 2: Resizable Layout & Multi-Session Tabs (Ideas #3 & #5)

### Task 2.1: Resizable Split Panes
- Draggable splitter between Terminal & SFTP pane in split mode.
- Draggable splitter between Local Explorer & Remote Explorer.
- Save widths to `localStorage`.

### Task 2.2: Multi-Host / Multi-Session Tab Bar
- Top tab bar allowing concurrent active SSH/SFTP sessions (`Server 1`, `Server 2`, `+ New`).
- Seamless switching without disconnecting.

---

## Phase 3: Transfer Queue Conflict Resolution (Idea #2)

### Task 3.1: Conflict Detection in Transfer Manager
- Check if file exists at destination before writing.
- If exists, trigger conflict event with details (file size, modified timestamp).

### Task 3.2: FileZilla-Style Conflict Dialog
- Actions: Overwrite, Overwrite if newer/size differs, Rename, Skip.
- Options: "Apply to this file only" vs "Apply to all transfers in current queue".

---

## Phase 4: Security Hardening & App Lock (Ideas #6 & #7)

### Task 4.1: Encrypted Credentials Vault (Master Password / OS Keychain)
- AES-256-GCM encryption for stored connection profiles.
- Master password option or native OS keychain integration.

### Task 4.2: App Lock with 2FA / TOTP Authenticator
- QR code setup in settings for Authenticator app (Google Authenticator / 1Password / Authy).
- Lock screen on app startup or idle timeout requiring 6-digit TOTP code.
