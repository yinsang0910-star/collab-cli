# Changelog

All notable changes to collab-cli will be documented in this file.

## [1.4.0] - 2026-06-06

### Added

- **Agent-to-Agent Commands** — Agents can send executable commands to each other without user intervention:
  - `collab cmd send --from A --to B --type command --instruction "做X"` — Send command
  - `collab cmd list --to <id>` — List pending commands for an agent
  - `collab cmd exec --agent <id>` — Auto-execute pending commands
  - `collab cmd status <cmd-id>` — View command details
  - Command types: `command`, `review`, `approve`, `reject`, `notify`, `delegate`
  - Status machine: `pending` → `executing` → `completed`/`failed`
  - Auto-execution on agent startup (P0 commands require user confirmation)
  - Auto-notifies sender of execution results
- **Self-Review Framework** — Agents review their own work before submitting to user:
  - `collab review create --task T-xxx` — Create multi-dimensional review
  - `collab review self T-xxx --agent id` — Auto self-check (completeness + self_check)
  - `collab review submit <id> <check> --passed true --score 85` — Submit check result
  - `collab review status <id>` — View review status
  - Review pipeline: configurable checks (code_quality, test_coverage, documentation, completeness)
  - Auto-assigns L3+ reviewers when available
  - Self-review mode for P2+ tasks (no external reviewer needed)
- 14 new tests (109 total)

## [1.3.0] - 2026-06-06

### Added

- **Web Dashboard** — `collab dashboard --port 8080` opens a browser-based visualization with dark theme, auto-refresh (30s), showing SHARD progress, badges, tasks kanban, memory stats, and conflicts (`src/commands/dashboard.js`)
- **MCP Enhancement** — Expanded from 12 to 17 tools:
  - `collab_memory_write` — Write memory fragments to L1 layer
  - `collab_shard_update` — Update SHARD sections (requires L3+)
  - `collab_peer_list` — List discovered LAN peers
  - `collab_conflict_create` — Create conflict records
- **Git Integration** — `collab git init/sync/status` for managing `.shared/` under git:
  - `collab git init` — Initialize `.shared/` as a git repository
  - `collab git sync [--push] [--pull]` — Auto-commit changes with categorized summaries
  - `collab git status` — Show uncommitted changes
  - Auto-categorizes changes: SHARD / tasks / inbox / memory

### Fixed

- shard.js: Acquire lock before writing archive (prevents duplicate data on lock failure)
- shard.js: Re-read fresh data object after lock acquisition (prevents stale writes)
- memory.js: Atomic write (tmp + rename) for archive append (prevents TOCTOU corruption)
- protocol.js: Check agent registration in MANIFEST during handshake
- sync.js: Task change detection hash now includes assignee + priority (not just status)
- server.js: Version comparison validates Number type before arithmetic

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
