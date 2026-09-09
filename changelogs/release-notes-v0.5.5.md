# OpenTerm v0.5.5 Release Notes

OpenTerm v0.5.5 resolves a critical session disconnect issue during rapid typing or key repeats, stabilizes terminal PTY writing, and introduces input batching.

## What's New & Fixes

### 1. Fix SSH Session Drops on Key Repeat
- **Root Cause**: In libssh2, `channel.flush()` invokes `libssh2_channel_flush_ex`, which discards incoming unread data packets from the session receive queue and improperly computes receive window refunds. Calling `.flush()` after every keystroke purged server echo/acknowledgement packets during key repeats, causing the remote server to disconnect or report channel EOF.
- **Removed Channel Flush**: Removed the errant `.flush()` call in the PTY writer thread. Direct `channel.write()` calls now stream cleanly without disturbing inbound packet buffers or window accounting.

### 2. Frontend Input Batching & Async Coalescing
- **Asynchronous Coalescing**: Key repeats occurring while an IPC write is in-flight are batched in memory and dispatched in a single batch once the previous IPC write resolves.
- **Zero Latency**: First-keystroke interactivity has 0ms delay, while high-frequency bursts (key hold, copy-paste) no longer flood the Tauri IPC channel.

### 3. Backend PTY Write Draining
- **Try-Recv Batching**: The PTY writer thread now uses `try_recv()` to drain all pending keystrokes from the MPSC channel before issuing network writes, reducing transport packet fragmentation.
- **Log Noise Removal**: Eliminated per-character debug logs on `ssh_write` and reader/writer threads to eliminate I/O lock contention on stderr.

---

## Verification & Stability
- 29/29 Cargo unit and integration tests passing.
- 63/63 Vitest unit and component tests passing.
- Clean Vite + TypeScript build.
