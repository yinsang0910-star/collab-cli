# Changelog

All notable changes to collab-cli will be documented in this file.

## [1.2.1] - 2026-06-06

### Security

- **CRITICAL**: Fixed optimistic lock bypass — lock now correctly detects conflicts after first write (`fs-lock.js`)
- **CRITICAL**: Fixed hardcoded `+08:00` timezone in SHARD auto-archive — now uses dynamic local timezone (`shard.js`)
- **CRITICAL**: Fixed message ID collision — inbox messages now use `crypto.randomUUID()` instead of sequential numbers (`inbox.js`)
- **CRITICAL**: Fixed task ID collision — tasks now use `crypto.randomUUID()` instead of sequential numbers (`task.js`)
- **CRITICAL**: Added HMAC signing to UDP discovery broadcast packets — prevents peer spoofing (`discovery.js`)
- **CRITICAL**: Restricted CORS from wildcard `*` to localhost/LAN only (`server.js`)
- **CRITICAL**: Added 1MB body size limit to HTTP server — prevents memory exhaustion DoS (`server.js`)
- **CRITICAL**: Fixed `pullFromPeer` silently skipping existing tasks — now merges by status (`sync.js`)

### Fixed

- Fixed substring matching in `findMessageFile` — `MSG-1` no longer matches `MSG-10` (`inbox.js`)
- Fixed substring matching in `findTaskFile` — `T-1` no longer matches `T-10` (`task.js`)
- Token comparison now uses `crypto.timingSafeEqual` — prevents timing attacks (`server.js`)
- Error messages no longer leaked to HTTP clients (`server.js`)
- Added schema validation for UDP discovery announcements (`discovery.js`)
- Added 10s timeout to all HTTP `fetch()` calls (`router.js`)
- Removed duplicate permission loop in `hasPermission()` (`protocol.js`)

## [1.2.0] - 2026-06-06

### Added

- **Cross-device SHARD/tasks sync** — `SyncManager` auto-pushes SHARD.md and tasks to all connected peers every 10 seconds (`src/node/sync.js`)
- **`collab node pull`** — Pull SHARD + tasks from a remote peer on first join
- **`collab setup`** — Interactive guided setup wizard for single/multi device (`src/commands/setup.js`)
- 5 new sync tests (95 total)

## [1.1.0] - 2026-06-06

### Added

- **LAN Node** — Cross-device agent collaboration over local network (`src/node/`)
- **UDP broadcast discovery** — Nodes auto-discover each other on LAN (port 9528)
- **HTTP API server** — Lightweight REST API for inbox, tasks, SHARD, status (port 9527)
- **Message router** — Automatic routing: local agents → file, remote agents → HTTP
- **Token authentication** — Random token per node for LAN security
- `collab node start` / `collab node status` CLI commands
- 17 new LAN node tests (90 total)

## [1.0.7] - 2026-06-06

### Changed

- Replaced project-specific examples in README with generic e-commerce scenario

## [1.0.6] - 2026-06-06

### Changed

- Rewrote all 4 README files (EN/ZH/JA/KO) with engaging, beginner-friendly content
- Added problem statement, visual architecture diagrams, real-world walkthrough
- Added comparison table with alternatives

## [1.0.5] - 2026-06-06

### Changed

- Added repository metadata to package.json (homepage, repository, bugs, keywords)

## [1.0.4] - 2026-06-06

### Changed

- Updated test count badge to 73 (stress tests added)

## [1.0.3] - 2026-06-06

### Added

- **Reasonix integration** — `REASONIX_PROTOCOL.md` template + `/collab` custom command
- **MCP Server** — stdio JSON-RPC 2.0 server with 12 tools (`src/commands/mcp-server.js`)
- `collab mcp` CLI command
- 5 new MCP server tests (64 total)

## [1.0.2] - 2026-06-06

### Fixed

- Fixed `collab --version` to read from package.json instead of hardcoded string

## [1.0.1] - 2026-06-06

### Fixed

- Fixed `bin` field in package.json (removed `./` prefix)

## [1.0.0] - 2026-06-06

### Added

- Initial release
- **Badge system** — L0-L4 role-based permissions for agents
- **3-layer memory** — SHARD (live ≤80 lines) → memory (fragments ≤50 lines) → archive (compressed by date)
- **Task lifecycle** — DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE state machine
- **Inbox messaging** — Structured messages with P0-P3 priority, types, response-required flags
- **Handshake protocol** — Auto-onboarding: read SHARD → get badge → check inbox → review tasks
- **Heartbeat monitoring** — Persistent inbox monitoring for long-running agents
- **Conflict resolution** — Optimistic locking + 3-layer protection (prevent/detect/arbitrate)
- **CLI tool** — `collab init/status/badge/task/inbox/memory/conflict/heartbeat`
- **Protocol templates** — CLAUDE_PROTOCOL, CODEX_PROTOCOL, CURSOR_PROTOCOL, AGENT_PROTOCOL
- **Multi-language README** — English, Chinese, Japanese, Korean
- 59 unit tests
