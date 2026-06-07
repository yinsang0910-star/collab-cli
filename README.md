<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-95%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<p align="center">
  <h1 align="center">🤝 collab-cli</h1>
  <p align="center"><strong>A collaboration protocol that makes multiple AI agents work together like a real team</strong></p>
  <p align="center">Works with Claude Code, Reasonix, Codex, WorkBuddy, Cursor, or any AI agent — on one device or across a LAN.</p>
</p>

<br/>

---

## Table of Contents

- [What is this?](#what-is-this)
- [Two modes: Single device vs Multi-device](#two-modes)
- [How it works (protocols & principles)](#how-it-works)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Agent commands (no user needed)](#agent-commands)
- [Self-review (auto quality check)](#self-review)
- [Complete walkthrough](#complete-walkthrough)
- [Agent integration](#agent-integration)
- [LAN Node (cross-device)](#lan-node)
- [CLI reference](#cli-reference)
- [Architecture](#architecture)
- [Development](#development)

---

## What is this? {#what-is-this}

**collab-cli solves a simple problem: multiple AI agents working on the same project don't know what each other are doing.**

Without collab-cli:

```
Claude Code session 1  ──→  Changes the API
Claude Code session 2  ──→  Doesn't know, changes it again
WorkBuddy              ──→  Runs nightly job, doesn't see the change
You (the human)        ──→  Explains everything from scratch every time
```

With collab-cli:

```
Claude Code  ──→  Writes to .shared/SHARD.md: "API changed to v2"
WorkBuddy    ──→  Reads SHARD.md: "Oh, API changed, I'll update my job"
You          ──→  Don't need to explain anything
```

**It's a shared folder (`.shared/`) + a protocol that all agents follow.** That's it. No servers required for single-device use.

<br/>

## Two modes: Single device vs Multi-device {#two-modes}

collab-cli works in **two modes**. Choose based on where your agents run:

### Mode 1: Single device (most users)

```
Your computer
├── .shared/              ← One shared folder, all agents read/write here
│   ├── SHARD.md             Current project state (≤80 lines)
│   ├── BADGE-claude-01.md   Claude's identity & permissions
│   ├── BADGE-workbuddy-01   WorkBuddy's identity & permissions
│   ├── inbox/               Messages between agents
│   ├── tasks/               Task board
│   └── memory/              Knowledge fragments
├── Claude Code           ← Reads .shared/
├── WorkBuddy             ← Reads .shared/
└── Codex                 ← Reads .shared/
```

**When to use**: All your agents run on the same computer. This is the most common case.

**How it works**: Pure filesystem. Agents read/write files in `.shared/`. Zero network, zero servers, zero configuration.

### Mode 2: Multi-device (LAN)

```
Computer A (192.168.1.100)           Computer B (192.168.1.101)
├── .shared/                         ├── .shared/
│   ├── SHARD.md  ←──── sync ────→  │   ├── SHARD.md
│   ├── tasks/   ←──── sync ────→   │   ├── tasks/
│   ├── inbox/codex-1/ (own only)   │   ├── inbox/codex-2/ (own only)
│   └── BADGE-*.md                  │   └── BADGE-*.md
├── collab node :9527  ←── HTTP ──→ ├── collab node :9527
└── Codex-1                          └── Codex-2
```

**When to use**: Your agents run on different computers on the same WiFi/LAN.

**How it works**: Each computer runs a `collab node` (lightweight HTTP server). Nodes discover each other via UDP broadcast. SHARD.md and tasks sync every 10 seconds. Inbox messages push in real-time.

### Which mode should I use?

| Your setup | Mode | Command |
|:--|:--|:--|
| All agents on one computer | **Single device** | `collab setup --devices 1` |
| Agents on 2+ computers, same LAN | **Multi-device** | `collab setup --devices 2` |
| Agents on different networks | Not supported yet | Use git sync as workaround |

<br/>

## How it works (protocols & principles) {#how-it-works}

### Communication protocols

collab-cli uses **four different protocols** depending on what's happening:

| Protocol | Port | Used for | When |
|:--|:--|:--|:--|
| **Filesystem** | N/A | SHARD, tasks, badges, memory | Single-device mode (always) |
| **UDP Broadcast** | 9528 | Peer discovery | Multi-device mode only |
| **HTTP REST** | 9527 | Message routing, SHARD sync, tasks sync | Multi-device mode only |
| **MCP (JSON-RPC)** | stdio | Plugin integration with Reasonix/Claude Desktop | Optional |

### Core principle: Files are the protocol

The entire system is built on **plain Markdown files with YAML frontmatter**. Any agent that can read and write files can participate. No special SDK, no API client, no runtime dependency.

```
---
id: MSG-001
from: claude-01
to: workbuddy-01
priority: P1
status: unread
---

# Please review the login module

The code is at src/auth/login.py.
```

This is what a message looks like. It's just a file. Any text editor can read it. Any AI agent can parse it.

### Core principle: Role-based access control

Every agent gets a **badge** when joining a project. The badge defines what the agent can and cannot do:

```
L4 Chief Engineer ──┬── Full access (read/write everything)
                    │
L3 Reviewer ────────┤── Can approve tasks, write SHARD
                    │
L2 Contributor ─────┤── Can write memory, submit reviews
                    │
L1 Executor ────────┤── Can write own tasks + inbox
                    │
L0 Observer ────────┴── Read-only
```

Different sessions of the same agent can hold different badges. Badges expire when the session ends.

### Core principle: 3-layer memory with auto-decay

To prevent memory bloat (every agent reading hundreds of lines), memory is split into three layers:

```
L0  SHARD.md     ← "What's true right now" (≤80 lines, every agent reads this)
L1  memory/       ← "What we've decided" (by topic, ≤50 lines each)
L2  archive/      ← "What happened before" (by date, only consulted when needed)
```

When SHARD exceeds 80 lines, old entries automatically move to archive/. **New agents only need to read 80 lines to understand the full picture.**

### Core principle: Task state machine

Every task follows a strict lifecycle:

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

Tasks cannot skip REVIEW. The Chief Engineer reviews, then the human gives final approval.

### Core principle: Handshake on entry

Every agent must execute a handshake when entering a project:

```
Step 1: Read MANIFEST.md   → System rules
Step 2: Read SHARD.md      → Current state (≤80 lines)
Step 3: Read BADGE-{id}.md → Your identity & permissions
Step 4: Check inbox        → Unread messages
Step 5: Check tasks        → Your active tasks
Step 6: Output summary     → Then respond to user
```

This ensures no agent starts working without knowing the current context.

<br/>

## Quick start {#quick-start}

### Option A: Setup wizard (recommended)

```bash
npm i -g collab-cli

# Single device — just works
collab setup --devices 1 --project "My Project"

# Multi device — generates per-device instructions
collab setup --devices 2 \
  --project "My Project" \
  --device-1 "DeviceA:codex-1@Codex" \
  --device-2 "DeviceB:codex-2@Codex"
```

The wizard will:
1. Initialize `.shared/` directory with all required files
2. Issue badges for all agents
3. Generate per-device startup instructions
4. Create `peers.yaml` with LAN config (multi-device only)

### Option B: Manual setup

```bash
npm i -g collab-cli

# Initialize
cd my-project
collab init --project "My Project"

# Issue badges
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue workbuddy-01 --role L2 --assigned-by user

# Set up agent instructions
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md

# Start collaborating
collab task create "First task" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to workbuddy-01 --title "Hello" --priority P1
```

<br/>

## Core concepts {#core-concepts}

### 🪪 Badge — Agent identity & permissions

Each agent receives a badge when entering a project. The badge defines the agent's role, permissions, and scope.

| Level | Name | Can do | Cannot do |
|:--|:--|:--|:--|
| L0 | Observer | Read SHARD, memory | Write anything |
| L1 | Executor | Write own tasks + inbox | Write SHARD, approve tasks |
| L2 | Contributor | L1 + write memory + submit reviews | Approve tasks, manage badges |
| L3 | Reviewer | L2 + approve tasks + write SHARD | Change other badges |
| L4 | Chief Engineer | Everything | — |

### 📬 Inbox — Structured messaging

Agents communicate through structured messages with priority (P0-P3), type (task/review/approval/question), and optional response-required flag.

### 📋 Task — Lifecycle-managed work items

Tasks follow a state machine: DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE. Only the assignee can change status. Completion requires Chief Engineer review + user confirmation.

### 🧠 Memory — Three layers with auto-decay

L0 SHARD (live, ≤80 lines) → L1 memory (fragments, ≤50 lines each) → L2 archive (compressed by date). Prevents memory bloat while preserving history.

### 🤝 Handshake — Automatic context loading

Every agent reads SHARD + badge + inbox + tasks on startup. No manual explanation needed.

<br/>

## Agent commands — No user needed {#agent-commands}

**The old way**: User tells Agent A → Agent A sends inbox message → User opens Agent B → Agent B reads and executes.

**The new way**: Agent A sends a command → Agent B auto-executes → Result sent back to A.

```
Agent A                                    Agent B
   │                                          │
   │  collab cmd send --to B --type command    │
   │  "运行 factor_pipeline.py"                │
   │──────────────────────────────────────────►│
   │                                          │
   │                                    Auto-execute
   │                                          │
   │  ◄──────── result: "3 factors passed" ───│
   │                                          │
```

### Command types

| Type | Purpose | Auto-execute? |
|:--|:--|:--:|
| `command` | Execute an action | ✅ (P1-P3) |
| `review` | Review a task | ✅ |
| `notify` | Information only | ✅ |
| `approve` | Approve a task | ❌ (needs user) |
| `reject` | Reject a task | ❌ (needs user) |
| `delegate` | Forward a task | ❌ (needs user) |

P0 commands always require user confirmation for safety.

### Usage

```bash
# Send a command
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "运行 factor_pipeline.py" --priority P1

# List pending commands
collab cmd list --to workbuddy-01 --status pending

# Auto-execute all pending commands for an agent
collab cmd exec --agent workbuddy-01

# View command details
collab cmd status CMD-xxx
```

### How auto-execution works

1. Agent receives a command (via inbox or LAN sync)
2. On next startup (handshake) or heartbeat check, agent finds pending commands
3. Non-P0 commands are executed automatically
4. Results are written back to the command file
5. Sender is notified via inbox

<br/>

## Self-review — Auto quality check {#self-review}

Before submitting work to the user, agents can automatically review their own work.

```
Agent finishes task
       │
       ▼
collab review self T-001 --agent claude-01
       │
       ▼
┌──────────────────────────────────┐
│ Check 1: completeness     ✅ 80  │
│ Check 2: self_check       ✅ 70  │
│                                  │
│ Result: PASSED (avg 75)          │
└──────────────────────────────────┘
       │
       ▼
  Submit to user for final approval
```

### Review modes

| Mode | When | How |
|:--|:--|:--|
| **Self-review** | P2+ tasks | Agent checks itself using a checklist |
| **Peer review** | P0/P1 tasks | Other agents (L3+) review the work |
| **Multi-review** | Critical tasks | Multiple reviewers, all must pass |

### Usage

```bash
# Self-review (P2+ tasks)
collab review self T-001 --agent claude-01

# Create multi-dimensional review
collab review create --task T-001 --by claude-01 --checks code_quality,test_coverage

# Submit review result
collab review submit RVW-xxx code_quality --reviewer reasonix-01 --passed true --score 85

# Check review status
collab review status RVW-xxx
```

<br/>

## Complete walkthrough {#complete-walkthrough}

See the real-world walkthrough in the detailed READMEs:
- [English walkthrough](./README.md#📖-a-complete-real-world-walkthrough)
- [中文演练](./README.zh-CN.md#📖-一个完整的真实场景)

<br/>

## Agent integration {#agent-integration}

| Agent | Integration method | File |
|:--|:--|:--|
| **Claude Code** | Append to `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | Copy to `.reasonix/system.md` or MCP plugin | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | Append to `.workbuddy/memory/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | Merge into `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | Copy as `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **Any agent** | Place `AGENT_PROTOCOL.md` in project root | `AGENT_PROTOCOL.md` |

See [templates/](./src/templates/) for all protocol files.

<br/>

## LAN Node (cross-device) {#lan-node}

### How multi-device sync works

```
┌──────────────────────────────────────────────────────────────────┐
│                      Multi-Device Architecture                    │
│                                                                  │
│  Device A                                    Device B            │
│  ┌─────────────────┐                       ┌─────────────────┐  │
│  │ collab node     │   UDP Broadcast       │ collab node     │  │
│  │ HTTP :9527      │◄─────────────────────►│ HTTP :9527      │  │
│  │ UDP  :9528      │   (auto-discovery)    │ UDP  :9528      │  │
│  └────────┬────────┘                       └────────┬────────┘  │
│           │                                         │           │
│           │            SHARD sync (10s)              │           │
│           │◄──────────── HTTP push ─────────────────►│           │
│           │            Tasks sync (10s)              │           │
│           │◄──────────── HTTP push ─────────────────►│           │
│           │            Inbox (real-time)             │           │
│           │◄──────────── HTTP push ─────────────────►│           │
│           │                                         │           │
│  ┌────────┴────────┐                       ┌────────┴────────┐  │
│  │ .shared/        │                       │ .shared/        │  │
│  │ SHARD.md ✅ sync│                       │ SHARD.md ✅ sync│  │
│  │ tasks/ ✅ sync  │                       │ tasks/ ✅ sync  │  │
│  │ inbox/a1 ❌ own │                       │ inbox/a2 ❌ own │  │
│  │ memory/ ✅ sync │                       │ memory/ ✅ sync │  │
│  └─────────────────┘                       └─────────────────┘  │
│                                                                  │
│  Codex-1                                   Codex-2              │
└──────────────────────────────────────────────────────────────────┘
```

### What syncs and what doesn't

| File | Synced? | Protocol | Strategy |
|:--|:--:|:--|:--|
| `SHARD.md` | ✅ | HTTP push every 10s | Version-based: newer version wins |
| `tasks/` | ✅ | HTTP push every 10s | Status merge: more advanced status wins |
| `memory/` | ✅ | HTTP push | Full replace |
| `inbox/` | ❌ | — | Per-device by design (each device stores its own agent's messages) |
| `MANIFEST.md` | — | Manual | Same on all devices (keep in sync via git) |
| `BADGE-*.md` | — | Manual | Same on all devices |

### LAN discovery protocol

1. Each node broadcasts a UDP packet on port 9528 every 5 seconds
2. The packet contains: `{ nodeId, agents: [...], apiPort }`
3. Other nodes receive the broadcast and register the peer
4. After 15 seconds without a heartbeat, the peer is marked as offline

### First-time setup on a new device

When a new device joins the network, it needs to pull existing data:

```bash
# On the new device
collab node pull --host 192.168.1.100 --port 9527 --token <token>
```

This pulls the current SHARD.md and all tasks from the existing node.

<br/>

## CLI reference {#cli-reference}

```bash
# ── Setup (start here) ──
collab setup                                    Guided setup wizard
collab setup --devices 1 --project "Name"       Single device
collab setup --devices 2 --device-1 "A:agent@Type" --device-2 "B:agent@Type"

# ── System ──
collab init --project "Name"                    Initialize .shared/
collab status                                   Global status overview
collab handshake <agent-id>                     Agent handshake check

# ── Badges ──
collab badge issue <id> --role <L0-L4>          Issue badge
collab badge show <id>                          Show badge details
collab badge list                               List all badges

# ── Tasks ──
collab task create <title> --assignee <id>      Create task
collab task list [--status <s>] [--assignee <id>]
collab task status <id>                         Task details
collab task update <id> <status>                Update status

# ── Inbox ──
collab inbox check <id>                         Check unread messages
collab inbox send --from <id> --to <id>         Send message
collab inbox read <id> <msg-id>                 Read (mark as read)
collab inbox done <id> <msg-id>                 Mark as done

# ── Memory ──
collab memory compact                           Auto-archive old entries
collab memory stats                             Layer statistics

# ── Heartbeat ──
collab heartbeat <id>                           Start persistent monitoring
collab heartbeat <id> --once                    Single check (exit 2 = P0/P1)

# ── Agent Commands ──
collab cmd send --from <id> --to <id>           Send command to another agent
collab cmd list [--to <id>] [--status <s>]      List commands
collab cmd exec --agent <id>                    Auto-execute pending commands
collab cmd status <cmd-id>                      View command details

# ── Self-Review ──
collab review self <task-id> --agent <id>       Self-review (checklist)
collab review create --task <id>                Create multi-dimensional review
collab review submit <id> <check>               Submit review result
collab review status <id>                       View review status

# ── LAN Node ──
collab node start [--agents <ids>] [--port N]   Start LAN node
collab node pull --host <ip>                    Pull SHARD + tasks from peer
collab node status                              Show node + discovered peers

# ── MCP Server ──
collab mcp                                      Start MCP server (stdio)
```

<br/>

## Architecture {#architecture}

### File structure

```
.shared/
├── MANIFEST.md              System declaration + agent registry + role definitions
├── SHARD.md                 L0 live memory (≤80 lines) — current state
├── BADGE-{agent-id}.md      Per-agent badge (multi-badge, one per agent)
├── peers.yaml               LAN node configuration (multi-device only)
├── inbox/{agent-id}/        Message inbox (per-agent directory)
│   └── 001-{topic}.md       Structured message (YAML frontmatter + Markdown body)
├── tasks/T-xxx.md           Task file (state machine + progress log)
├── memory/                  L1 memory fragments (by topic, ≤50 lines each)
│   ├── decisions.md
│   ├── lessons.md
│   └── architecture.md
├── archive/                 L2 archive (by date, auto-compressed)
│   └── 2026-06-06.md
└── conflicts/               Conflict records (awaiting Chief Engineer arbitration)
    └── C-{timestamp}.md
```

### Module structure

```
collab-cli/
├── bin/collab.js              CLI entry (20+ subcommands)
├── src/
│   ├── commands/              Command implementations
│   │   ├── init.js            Initialization + migration
│   │   ├── setup.js           Setup wizard
│   │   ├── status.js          Global status
│   │   ├── badge.js           Badge management
│   │   ├── task.js            Task lifecycle
│   │   ├── inbox.js           Messaging
│   │   ├── memory.js          Memory decay
│   │   ├── conflict.js        Conflict resolution
│   │   ├── heartbeat.js       Heartbeat monitoring
│   │   ├── node.js            LAN node command
│   │   └── mcp-server.js      MCP server
│   ├── core/                  Core modules
│   │   ├── protocol.js        Handshake protocol + permissions
│   │   ├── shard.js           SHARD management + auto-archive
│   │   ├── fs-lock.js         Optimistic file locking
│   │   └── yaml.js            YAML frontmatter engine
│   ├── node/                  LAN node modules
│   │   ├── discovery.js       UDP broadcast peer discovery
│   │   ├── server.js          HTTP API server
│   │   ├── router.js          Message routing (local/remote)
│   │   └── sync.js            Cross-device SHARD/tasks sync
│   ├── templates/             Protocol templates for each agent type
│   └── utils/                 Timestamp + markdown utilities
├── package.json               collab-cli
├── README.md                  English
├── README.zh-CN.md            Chinese
├── README.ja.md               Japanese
└── README.ko.md               Korean
```

### Conflict resolution (three layers)

```
Layer 1: Prevention
├─ Task assignee is explicit → others don't touch it
├─ SHARD.md checks last_updated_by before writing
└─ Scope limits each agent's working directories

Layer 2: Detection
├─ Frontmatter last_updated_by + last_updated_at
└─ Optimistic lock compares version on write

Layer 3: Arbitration
├─ Conflict written to conflicts/C-{timestamp}.md
├─ Chief Engineer resolves within 24h
└─ If Chief Engineer can't decide → escalate to user
```

### Comparison with alternatives

| Feature | Manual coordination | Git branches | **collab-cli** |
|:--|:--:|:--:|:--:|
| Real-time messaging | ❌ | ❌ | ✅ |
| Role-based permissions | ❌ | Branch-level | File-level |
| Shared memory | Verbal | Commit messages | Structured 3-layer |
| Task lifecycle | Verbal | PR/Issue | Built-in state machine |
| New agent onboarding | Re-explain everything | Clone repo | Handshake auto-aligns |
| Cross-device sync | N/A | git pull/push | Auto HTTP sync (10s) |
| Token cost | Re-read everything | N/A | ≤80 lines live memory |

<br/>

## Development {#development}

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli
npm install
npm test          # 95 tests passing
npm link          # Local development
```

## License

MIT

---

<p align="center">If this project helped you, give it a ⭐!</p>
