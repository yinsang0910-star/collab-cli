<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-109%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<h1 align="center">🤝 collab-cli</h1>
<p align="center"><strong>Cross-device agent collaboration with shared memory</strong></p>
<p align="center">Multiple AI agents on different machines, working together like a real team — shared context, direct commands, automatic review.</p>

<br/>

---

## What it does in one sentence

> **You have AI agents on different computers? collab-cli makes them collaborate — sharing memory, sending commands, reviewing each other's work — without you playing messenger.**

<br/>

## 4 things it does that nothing else does

### 1. 🌐 Cross-device collaboration

Agents on **different computers** auto-discover each other over LAN and sync in real-time.

```
Computer A (192.168.1.100)              Computer B (192.168.1.101)
┌──────────────────────┐                ┌──────────────────────┐
│  Codex-1             │   UDP auto     │  Codex-2             │
│  collab node :9527   │◄──discover───►│  collab node :9527   │
│                      │                │                      │
│  SHARD.md ◄── sync ──┼──────────────►│  SHARD.md            │
│  tasks/  ◄── sync ───┼──────────────►│  tasks/              │
│  inbox/  ◄── real ───┼──────────────►│  inbox/              │
└──────────────────────┘                └──────────────────────┘
```

**No cloud. No server. Just WiFi.** UDP auto-discovery, HTTP sync every 10 seconds.

### 2. 🧠 Shared memory that doesn't bloat

Every agent reads the same 80-line file to understand the full project state. Old entries auto-archive. New agents onboard in 30 seconds.

```
L0  SHARD.md     ← "What's true right now"    (≤80 lines, every agent reads)
L1  memory/       ← "What we've decided"       (≤50 lines per file, by topic)
L2  archive/      ← "What happened before"     (auto-compressed by date)
```

**Result**: 3 agents, 2 weeks of history, still only 80 lines to read on startup.

### 3. 📨 Agents command each other directly

No more relaying messages through the user. Agent A sends a command → Agent B auto-executes → result goes back to A.

```
Agent A                                  Agent B
   │                                        │
   │  "Run factor_pipeline.py"              │
   │───────────────────────────────────────►│
   │                                        │
   │                                  Auto-execute
   │                                        │
   │  ◄──────── "3 factors passed" ─────────│
```

**P0 commands require user confirmation.** Everything else is automatic.

### 4. 🔍 Self-review before submission

Agents review their own work before submitting to the user. Multi-dimensional checks (code quality, test coverage, documentation). Fails get auto-rejected with specific feedback.

```
Agent finishes task
       │
       ▼
  Self-review (code + tests + docs)
       │
   ┌───┴───┐
 Passed   Failed → auto-reject + feedback
   │
   ▼
  Submit to user for final OK
```

<br/>

## Works with any agent

| Agent | Integration | Time to set up |
|:--|:--|:--|
| **Claude Code** | Append to `.claude/CLAUDE.md` | 1 minute |
| **Reasonix** | Copy to `.reasonix/system.md` or MCP plugin | 1 minute |
| **WorkBuddy** | Append to `.workbuddy/memory/MEMORY.md` | 1 minute |
| **Cursor** | Merge into `.cursor/rules` | 1 minute |
| **Codex** | Copy as `AGENTS.md` | 1 minute |
| **Any agent** | Place `AGENT_PROTOCOL.md` in project root | 1 minute |

**It's just files.** No SDK, no runtime dependency, no vendor lock-in.

<br/>

## 30-second quick start

```bash
npm i -g collab-cli

# Single computer (all agents on one machine)
collab setup --devices 1 --project "My Project"

# Multiple computers (agents on different machines)
collab setup --devices 2 \
  --device-1 "ComputerA:codex-1@Codex" \
  --device-2 "ComputerB:codex-2@Codex"
```

The setup wizard will:
1. Create `.shared/` with all files
2. Issue badges for all agents
3. Print step-by-step instructions for each device

<br/>

---

## Detailed documentation

<details>
<summary><strong>📋 Core concepts</strong> (badges, tasks, inbox, memory, handshake)</summary>

### 🪪 Badge — Role-based permissions

Every agent gets a badge when joining. Defines what they can and cannot do.

| Level | Name | Can do |
|:--|:--|:--|
| L0 | Observer | Read-only |
| L1 | Executor | Write own tasks + inbox |
| L2 | Contributor | L1 + write memory + submit reviews |
| L3 | Reviewer | L2 + approve tasks + write SHARD |
| L4 | Chief Engineer | Everything + assign tasks + manage badges |

Different sessions of the same agent can hold different badges.

### 📋 Task — Lifecycle-managed work items

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

Tasks cannot skip REVIEW. Chief Engineer reviews, user gives final approval.

### 📬 Inbox — Structured messaging

Messages with priority (P0-P3), type (task/review/approval/question), related task, and response-required flag.

### 🤝 Handshake — Auto-onboarding

Every agent reads SHARD + badge + inbox + tasks on startup. No manual explanation needed.

</details>

<details>
<summary><strong>📨 Agent commands</strong> (how agents command each other)</summary>

### Command types

| Type | Purpose | Auto-execute? |
|:--|:--|:--:|
| `command` | Execute an action | ✅ (P1-P3) |
| `review` | Review a task | ✅ |
| `notify` | Information only | ✅ |
| `approve` | Approve a task | ❌ (needs user) |
| `reject` | Reject a task | ❌ (needs user) |
| `delegate` | Forward a task | ❌ (needs user) |

### Usage

```bash
# Send a command
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "Run factor_pipeline.py" --priority P1

# List pending commands
collab cmd list --to workbuddy-01 --status pending

# Auto-execute all pending
collab cmd exec --agent workbuddy-01
```

</details>

<details>
<summary><strong>🔍 Self-review</strong> (how quality is enforced)</summary>

```bash
# Self-review (P2+ tasks)
collab review self T-001 --agent claude-01

# Multi-dimensional review
collab review create --task T-001 --by claude-01 --checks code_quality,test_coverage

# Submit check result
collab review submit RVW-xxx code_quality --reviewer reasonix-01 --passed true --score 85
```

</details>

<details>
<summary><strong>🌐 LAN Node</strong> (cross-device sync details)</summary>

### How it works

1. **UDP Broadcast** (port 9528): Nodes announce every 5 seconds
2. **Auto Discovery**: Nodes find each other on LAN
3. **Smart Routing**: Messages → local file or remote HTTP
4. **Token Auth**: Random token per node

### What syncs

| File | Synced? | Strategy |
|:--|:--:|:--|
| `SHARD.md` | ✅ | Version-based, newer wins |
| `tasks/` | ✅ | Status merge, advanced wins |
| `memory/` | ✅ | Full sync |
| `inbox/` | ❌ | Per-device (by design) |

### Commands

```bash
collab node start --agents codex-1        Start LAN node
collab node pull --host 192.168.1.100     Pull SHARD + tasks from peer
collab node status                        Show node + peers
```

</details>

<details>
<summary><strong>💓 Heartbeat</strong> (persistent inbox monitoring)</summary>

```bash
collab heartbeat claude-01               Every 5 minutes
collab heartbeat claude-01 --once        Single check (exit 2 = P0/P1)
collab heartbeat claude-01 --interval 60 Every 60 seconds
```

</details>

<details>
<summary><strong>🔌 MCP Server</strong> (plugin integration)</summary>

```toml
# reasonix.toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

17 tools: status, handshake, inbox (check/send/read), task (create/list/update), badge, memory (stats/compact/write), shard_update, peer_list, conflict (list/create).

</details>

<details>
<summary><strong>🌐 Web Dashboard</strong> (browser visualization)</summary>

```bash
collab dashboard --port 8080
# Opens http://localhost:8080 — dark theme, auto-refresh 30s
# Shows: SHARD progress, badges, tasks kanban, memory, conflicts
```

</details>

<details>
<summary><strong>📦 Git Integration</strong> (.shared/ under version control)</summary>

```bash
collab git init              Initialize .shared/ as git repo
collab git sync --push       Auto-commit + push
collab git status            Show uncommitted changes
```

</details>

<details>
<summary><strong>⚡ Conflict Resolution</strong> (when two agents edit the same file)</summary>

```
Layer 1: Prevention  — Task assignee explicit, scope limits
Layer 2: Detection   — Optimistic lock (last_updated_by + last_updated_at)
Layer 3: Arbitration — conflicts/ directory, Chief Engineer resolves
```

</details>

<details>
<summary><strong>📚 Full CLI Reference</strong></summary>

```bash
collab setup                                    Guided setup wizard
collab init --project "Name"                    Initialize .shared/
collab status                                   Global status
collab handshake <agent-id>                     Agent handshake

collab badge issue/show/list                    Badge management
collab task create/list/status/update           Task management
collab inbox check/send/read/done               Messaging
collab cmd send/list/exec/status                Agent commands
collab review create/submit/self/status          Reviews
collab memory compact/stats                     Memory management
collab conflict list/resolve                    Conflict management
collab heartbeat <id> [--once] [--interval N]   Inbox monitoring
collab dashboard [--port N]                     Web dashboard
collab mcp                                      MCP server
collab node start/pull/status                   LAN node
collab git init/sync/status                     Git integration
```

</details>

<br/>

## Architecture

```
.collab/
├── MANIFEST.md              System rules + agent registry
├── SHARD.md                 L0 live memory (≤80 lines)
├── BADGE-{agent-id}.md      Per-agent badge
├── peers.yaml               LAN config
├── inbox/{agent-id}/        Messages (per-agent)
├── tasks/T-xxx.md           Task files
├── commands/CMD-xxx.yaml    Agent commands
├── reviews/RVW-xxx.yaml     Review records
├── memory/                  L1 fragments
├── archive/                 L2 compressed history
└── conflicts/               Conflict records
```

<br/>

## Development

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli && npm install && npm test    # 109 tests passing
```

## License

MIT

---

<p align="center">If this helped you, give it a ⭐</p>
