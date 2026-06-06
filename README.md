<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

# collab-cli

A universal collaboration protocol + CLI for multi-agent LLM teams. Any agent — Claude Code, Reasonix, Codex, WorkBuddy, Cursor, or others — can join a project, claim a badge, and start collaborating under a shared protocol.

## Supported Agents

| Agent | Integration | Protocol Template |
|-------|-------------|-------------------|
| **Claude Code** | `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | `.reasonix/system.md` + MCP plugin | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | `.workbuddy/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **Any Agent** | Root `COLLAB_PROTOCOL.md` | `AGENT_PROTOCOL.md` |

## Quick Start

```bash
# Install
npm i -g collab-cli

# Initialize in your project
cd /path/to/your/project
collab init --project "My Project"

# Issue badges for agents
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue reasonix-01 --role L2 --assigned-by user

# Agent handshake (once per session)
collab handshake claude-01
```

## Core Concepts

### Badge System

Each agent receives a badge when entering a project, defining its role and permissions. Different sessions of the same agent can hold different badges.

| Level | Name | Permissions |
|-------|------|-------------|
| L0 | Observer | Read-only |
| L1 | Executor | Read all + write own tasks + write inbox |
| L2 | Contributor | L1 + write memory + submit reviews |
| L3 | Reviewer | L2 + approve tasks + write SHARD |
| L4 | Chief Engineer | Full access + assign tasks + manage badges |

### Memory Layers

```
L0  SHARD.md     ← Live memory (≤80 lines) — current state, required reading
L1  memory/      ← Structured fragments (≤50 lines each) — by topic
L2  archive/     ← Compressed history by date — consulted only when needed
```

Auto-decay: when SHARD exceeds 80 lines, old entries are archived automatically.

### Task Lifecycle

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

Tasks require Chief Engineer review + user final approval.

### Inbox System

Structured messaging between agents with priority levels (P0-P3), message types, related tasks, and response-required flags.

### Handshake Protocol

Every agent's first action upon entering a project:

1. Read `MANIFEST.md` — system rules, agent registry
2. Read `SHARD.md` — current state (≤80 lines)
3. Read / request badge `BADGE-{id}.md`
4. Check `inbox/{id}/` for unread messages
5. Check `tasks/` for own active tasks
6. Output handshake summary, then respond to user

## CLI Commands

```bash
# System
collab init                           Initialize collaboration system
collab status                         Global status overview
collab handshake <agent-id>           Agent handshake

# Badges
collab badge issue <id> --role <L>    Issue badge
collab badge show <id>                Show badge
collab badge list                     List all badges

# Tasks
collab task create <title>            Create task
collab task list                      List tasks
collab task status <id>               Task details
collab task update <id> <status>      Update status

# Inbox
collab inbox check <id>               Check unread
collab inbox send                     Send message
collab inbox read <id> <msg-id>       Read message
collab inbox done <id> <msg-id>       Mark done

# Memory
collab memory compact                 Compact memory
collab memory stats                   Memory statistics
collab memory archive <date>          Archive by date

# Conflicts
collab conflict list                  List conflicts
collab conflict resolve <id>          Resolve conflict

# Heartbeat
collab heartbeat <agent-id>           Start persistent monitoring
collab heartbeat <agent-id> --once    Single check (exit 2 = high priority)
collab heartbeat <agent-id> --interval 60  Custom interval (seconds)

# MCP Server
collab mcp                            Start MCP server (stdio JSON-RPC)
```

## File Structure

```
.shared/
├── MANIFEST.md              System declaration + agent registry
├── SHARD.md                 L0 live memory (≤80 lines)
├── BADGE-{agent-id}.md      Per-agent badges (multi-badge parallel)
├── inbox/{agent-id}/        Message inbox (per-agent directories)
│   └── 001-{topic}.md       Structured messages (with frontmatter)
├── tasks/T-xxx.md           Task files (state machine + progress log)
├── memory/                  L1 memory fragments (by topic, ≤50 lines each)
│   ├── decisions.md
│   ├── lessons.md
│   └── architecture.md
├── archive/                 L2 archive (by date, ≤50 lines each)
│   └── 2026-06-06.md
└── conflicts/               Conflict records (awaiting arbitration)
    └── C-{timestamp}.md
```

## Agent Integration

### Claude Code

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

Claude Code will automatically execute handshake on each new session.

### Reasonix

**Option A: Protocol injection (recommended)**

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

**Option B: Custom command**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

Users type `/collab handshake` to trigger handshake.

**Option C: MCP plugin (strongest integration)**

In `reasonix.toml`:

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonix gains 12 collab tools (`mcp__collab__inbox_check`, etc.) natively.

### WorkBuddy

Append `AGENT_PROTOCOL.md` to `.workbuddy/MEMORY.md`.

### Cursor

Merge `CURSOR_PROTOCOL.md` into `.cursor/rules`.

### Codex / Any Agent

Place `CODEX_PROTOCOL.md` or `AGENT_PROTOCOL.md` in project root or agent's instruction file.

## MCP Server

Built-in MCP server following the [Model Context Protocol](https://modelcontextprotocol.io/) spec (JSON-RPC 2.0 over stdio).

### Exposed Tools

| MCP Tool | Function |
|:--|:--|
| `collab_status` | Global status |
| `collab_handshake` | Agent handshake |
| `collab_inbox_check` | Check unread messages |
| `collab_inbox_send` | Send message |
| `collab_inbox_read` | Read message (mark read) |
| `collab_task_create` | Create task |
| `collab_task_list` | List tasks |
| `collab_task_update` | Update task status |
| `collab_badge_issue` | Issue badge |
| `collab_memory_stats` | Memory statistics |
| `collab_memory_compact` | Compact memory |
| `collab_conflict_list` | List conflicts |

## Heartbeat

Long-running inbox monitoring for persistent agents:

```bash
# Persistent mode — check every 5 minutes
collab heartbeat claude-01

# Single check — exit 0 = no messages, exit 2 = high priority
collab heartbeat claude-01 --once

# Custom interval — every 60 seconds
collab heartbeat claude-01 --interval 60
```

Notification format (machine-parseable):
```
[COLLAB_HEARTBEAT] {"type":"new_message","agentId":"claude-01","message":{"id":"MSG-001","priority":"P0",...}}
```

## Conflict Resolution

Three-layer protection:

1. **Prevention** — Task `assignee` is explicit; `scope` limits working directories
2. **Detection** — Frontmatter `last_updated_by` + `last_updated_at` optimistic locking
3. **Arbitration** — Written to `conflicts/`; Chief Engineer resolves within 24h

## Protocol Compatibility

All agents share the same `.shared/` file structure. The protocol layer is **pure Markdown + YAML** — no dependency on any agent-specific mechanism.

- **Files as Protocol** — Any agent that can read/write files can participate
- **CLI is Convenience** — Agents can also use `read_file` / `write_file` directly
- **MCP is Enhancement** — Plugin mechanism provides structured tool calls

## Development

```bash
npm install
npm test          # 64 tests
npm link          # Local development
npm publish       # Publish to npm
```

## License

MIT
