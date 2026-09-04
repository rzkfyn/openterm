# Architecture & Implementation Plan: Unified SSH & SFTP Client

## Executive Summary
This document outlines the architecture for building a lightweight, dual-purpose SSH terminal and SFTP file manager. By utilizing a native webview approach rather than bundling a standalone renderer (like Oryxis) or a full Chromium engine (like Termius), the target memory footprint is strictly contained within the 80MB to 150MB range.

## Core Technology Stack
The application leverages a modern, webview-reliant stack to minimize idle overhead while maintaining high UI performance.
* **Core Framework:** Tauri 2
* **Frontend UI:** React 19 + TypeScript + Vite
* **Styling:** Tailwind CSS v4
* **State Management:** Zustand
* **Terminal Emulator:** xterm.js
* **Backend Systems:** Rust (handling networking, IPC, and OS-level APIs)

## System Architecture

### 1. The Terminal Layer (SSH)
The SSH protocol must be strictly isolated from the JavaScript runtime to prevent memory leaks and UI thread blocking.
* **Backend (Rust):** Establish and maintain the SSH connection using a native Rust crate (e.g., `ssh2-rs` or `russh`). 
* **Data Streaming:** Read the raw pseudo-terminal (PTY) I/O bytes in Rust.
* **Frontend Delivery:** Stream the byte payloads directly to `xterm.js` in the React frontend via Tauri's event emission system rather than standard IPC invokes.

### 2. The File Manager Layer (SFTP)
A seamless, dual-pane file manager requires careful memory orchestration, as massive directory trees can overwhelm Tauri's IPC serialization (JSON).
* **Chunked Directory Queries:** When querying a remote directory with thousands of files, Rust must paginate or chunk the data before sending it over the IPC. 
* **State Updates:** Zustand handles the directory state tree. UI virtual lists (e.g., `@tanstack/react-virtual`) should be used to render the files in the DOM, preventing memory spikes when navigating large folders.
* **Binary Handling Rule:** File binaries must **never** touch the JavaScript runtime. If a user initiates a download/upload, the React UI sends a command to Rust. Rust handles the actual SFTP binary stream to/from the local disk and only emits lightweight progress updates (e.g., `{ file: 'app.jar', progress: 45 }`) back to the frontend.

### 3. Native Integration & Bundling
Building upon previous patterns used for packaging CLI tools (like `ffmpeg` or `scrcpy`), additional native binaries or utilities can be sidecar-bundled through Tauri if advanced tunneling or specialized proxy protocols are required beyond the standard Rust SSH implementations.

## Implementation Phases

**Phase 1: Foundation & PTY Setup**
* Initialize Tauri 2 project with the Vite/React 19 template.
* Integrate `xterm.js` and establish a basic PTY stream from Rust to the frontend to ensure rendering latency is acceptable.

**Phase 2: SSH Integration**
* Implement `ssh2-rs` for authentication (Password, PubKey).
* Bind the SSH session I/O to the PTY stream.

**Phase 3: SFTP & Dual-Pane UI**
* Build the Tailwind v4 dual-pane layout.
* Implement remote directory traversal in Rust and IPC pagination.
* Wire Zustand to manage local/remote directory states.
* Implement direct-to-disk file transfers bypassing the webview.

**Phase 4: Polish & Profiling**
* Implement UI virtualized lists for directory rendering.
* Profile memory usage under heavy load (e.g., transferring large files while running `htop` in the terminal).

## References & Resource Links
* **Tauri 2 Documentation:** [https://v2.tauri.app/](https://v2.tauri.app/)
* **xterm.js:** [https://xtermjs.org/](https://xtermjs.org/)
* **ssh2-rs Crate:** [https://crates.io/crates/ssh2](https://crates.io/crates/ssh2)
* **russh Crate (Async SSH):** [https://crates.io/crates/russh](https://crates.io/crates/russh)
* **TanStack Virtual (for massive file lists):** [https://tanstack.com/virtual/latest](https://tanstack.com/virtual/latest)
* **Zustand:** [https://github.com/pmndrs/zustand](https://github.com/pmndrs/zustand)
